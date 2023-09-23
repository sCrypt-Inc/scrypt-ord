/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import {
    ContractTransaction,
    MethodCallOptions,
    PubKey,
    SmartContract,
    StatefulNext,
    bsv,
    findSig,
    sha256,
    toByteString,
    toHex,
} from 'scrypt-ts'
import { HashPuzzleFT } from '../contracts/hashPuzzleFT'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH, FTReceiver, fromByteString, BSV20V1 } from '../scrypt-ord'
import { dummybsv20 } from './utils'
use(chaiAsPromised)

describe('Test multi inputs and outputs', () => {
    const tick = toByteString('OOO1', true)
    const max = 21000000n
    const lim = max

    before(async () => {
        HashPuzzleFT.loadArtifact()
    })

    it('should transfer 2 ordp2pkh to 1 hashPuzzle successfully.', async () => {
        const transferBSV20 = async () => {
            const signer = getDefaultSigner()
            const address = await signer.getDefaultAddress()
            const ordP2PKHs = [
                dummybsv20(address, fromByteString(tick), 4n),
                dummybsv20(address, fromByteString(tick), 5n),
            ].map((utxo) => OrdP2PKH.fromP2PKH(utxo))

            const message = toByteString('hello, sCrypt!', true)

            await Promise.all(ordP2PKHs.map((p) => p.connect(signer)))
            const recipients: Array<FTReceiver> = [
                {
                    instance: new HashPuzzleFT(tick, max, lim, sha256(message)),
                    amt: 6n,
                },
            ]

            const { tx } = await OrdP2PKH.transfer(
                ordP2PKHs,
                signer,
                recipients
            )

            console.log('transfer tx:', tx.id)
        }

        return expect(transferBSV20()).not.be.rejected
    })

    it('should transfer 2 ordp2pkh to 2 hashPuzzle successfully.', async () => {
        const transferBSV20 = async () => {
            const signer = getDefaultSigner()
            const address = await signer.getDefaultAddress()
            const ordP2PKHs = [
                dummybsv20(address, fromByteString(tick), 4n),
                dummybsv20(address, fromByteString(tick), 5n),
            ].map((utxo) => OrdP2PKH.fromP2PKH(utxo))

            await Promise.all(ordP2PKHs.map((p) => p.connect(signer)))

            const message1 = toByteString('1:hello, sCrypt!', true)
            const message2 = toByteString('2:hello, sCrypt!', true)

            const recipients: Array<FTReceiver> = [
                {
                    instance: new HashPuzzleFT(
                        tick,
                        max,
                        lim,
                        sha256(message1)
                    ),
                    amt: 6n,
                },
                {
                    instance: new HashPuzzleFT(
                        tick,
                        max,
                        lim,
                        sha256(message2)
                    ),
                    amt: 3n,
                },
            ]

            const { tx } = await OrdP2PKH.transfer(
                ordP2PKHs,
                signer,
                recipients
            )

            console.log('transfer tx:', tx.id)
        }

        return expect(transferBSV20()).not.be.rejected
    })

    it('should transfer 1 ordp2pkh and 1 hashPuzzle to 1 hashPuzzle successfully.', async () => {
        const transferBSV20 = async () => {
            const message1 = toByteString('1:hello, sCrypt!', true)
            const message2 = toByteString('2:hello, sCrypt!', true)

            const signer = getDefaultSigner()
            const address = await signer.getDefaultAddress()
            const sender0: OrdP2PKH = OrdP2PKH.fromP2PKH(
                dummybsv20(address, fromByteString(tick), 4n)
            )

            await sender0.connect(signer)

            const sender1 = new HashPuzzleFT(tick, max, lim, sha256(message1))
            await sender1.connect(signer)
            await sender1.mint(5n)

            const recipients: Array<FTReceiver> = [
                {
                    instance: new HashPuzzleFT(
                        tick,
                        max,
                        lim,
                        sha256(message1)
                    ),
                    amt: 6n,
                },
                {
                    instance: new HashPuzzleFT(
                        tick,
                        max,
                        lim,
                        sha256(message2)
                    ),
                    amt: 3n,
                },
            ]

            const totalTokenAmt = sender0.getBSV20Amt() + sender1.getAmt()

            const tokenAmt = recipients.reduce((acc, receiver) => {
                acc += receiver.amt
                return acc
            }, 0n)

            const tokenChangeAmt = totalTokenAmt - tokenAmt

            if (tokenChangeAmt < 0n) {
                throw new Error('Not enough token!')
            }
            const ordPubKey = await signer.getDefaultPubKey()

            sender0.bindTxBuilder(
                'unlock',
                async (
                    current: OrdP2PKH,
                    options: MethodCallOptions<OrdP2PKH>
                ): Promise<ContractTransaction> => {
                    const tx = new bsv.Transaction()
                    const nexts: StatefulNext<SmartContract>[] = []

                    for (let i = 0; i < recipients.length; i++) {
                        const receiver = recipients[i]

                        if (receiver.instance instanceof BSV20V1) {
                            receiver.instance.setAmt(receiver.amt)
                        } else if (receiver.instance instanceof OrdP2PKH) {
                            receiver.instance.setBSV20(tick, receiver.amt)
                        } else {
                            throw new Error(
                                'unsupport receiver, only BSV20V1 or OrdP2PKH!'
                            )
                        }

                        tx.addOutput(
                            new bsv.Transaction.Output({
                                script: receiver.instance.lockingScript,
                                satoshis: 1,
                            })
                        )

                        nexts.push({
                            instance: receiver.instance,
                            balance: 1,
                            atOutputIndex: i,
                        })
                    }

                    if (tokenChangeAmt > 0n) {
                        const p2pkh = OrdP2PKH.fromAddress(ordPubKey)

                        p2pkh.setBSV20(fromByteString(tick), tokenChangeAmt)

                        tx.addOutput(
                            new bsv.Transaction.Output({
                                script: p2pkh.lockingScript,
                                satoshis: 1,
                            })
                        )

                        nexts.push({
                            instance: p2pkh,
                            balance: 1,
                            atOutputIndex: nexts.length,
                        })
                    }

                    tx.change(ordPubKey.toAddress())

                    tx.addInput(current.buildContractInput())

                    return Promise.resolve({
                        tx: tx,
                        atInputIndex: 0,
                        nexts,
                    })
                }
            )

            let partialContractTx = await sender0.methods.unlock(
                (sigResps) => findSig(sigResps, ordPubKey),
                PubKey(toHex(ordPubKey)),
                {
                    pubKeyOrAddrToSign: ordPubKey,
                    multiContractCall: true,
                } as MethodCallOptions<OrdP2PKH>
            )

            sender1.bindTxBuilder(
                'unlock',
                async (
                    current: HashPuzzleFT,
                    options: MethodCallOptions<HashPuzzleFT>
                ): Promise<ContractTransaction> => {
                    if (options.partialContractTx) {
                        const tx = options.partialContractTx.tx
                        tx.addInput(current.buildContractInput())

                        return Promise.resolve({
                            tx: tx,
                            atInputIndex: 1,
                            nexts: partialContractTx.nexts,
                        })
                    }

                    throw new Error('no partialContractTx')
                }
            )

            partialContractTx = await sender1.methods.unlock(message1, {
                partialContractTx,
                transfer: recipients,
                pubKeyOrAddrToSign: ordPubKey,
                multiContractCall: true,
            } as MethodCallOptions<OrdP2PKH>)

            const { tx } = await SmartContract.multiContractCall(
                partialContractTx,
                signer
            )

            console.log('transfer tx:', tx.id)
        }

        return expect(transferBSV20()).not.be.rejected
    })
})
