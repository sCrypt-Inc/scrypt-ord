import { expect, use } from 'chai'
import {
    Addr,
    ContractTransaction,
    MethodCallOptions,
    PubKey,
    SmartContract,
    StatefulNext,
    bsv,
    findSig,
    sha256,
    toByteString,
} from 'scrypt-ts'
import { HashLockFT } from '../contracts/hashLockFT'
import { getDefaultSigner, randomPrivateKey } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import {
    BSV20P2PKH,
    FTReceiver,
    fromByteString,
    BSV20,
    OrdiMethodCallOptions,
} from '../scrypt-ord'
import { dummyBSV20 } from './utils'
use(chaiAsPromised)

describe('Test multi inputs and outputs', () => {
    const tick = toByteString('OOO1', true)
    const max = 21000000n
    const lim = max
    const dec = 0n

    before(async () => {
        HashLockFT.loadArtifact()
    })

    it('should transfer 2 BSV20P2PKH to 1 hashLock successfully.', async () => {
        const transferBSV20 = async () => {
            const signer = getDefaultSigner()
            const address = await signer.getDefaultAddress()
            const bsv20P2PKHs = [
                dummyBSV20(address, fromByteString(tick), 4n),
                dummyBSV20(address, fromByteString(tick), 5n),
            ].map((utxo) => BSV20P2PKH.fromUTXO(utxo))

            const message = toByteString('hello, sCrypt!', true)

            await Promise.all(bsv20P2PKHs.map((p) => p.connect(signer)))
            const recipients: Array<FTReceiver> = [
                {
                    instance: new HashLockFT(
                        tick,
                        max,
                        lim,
                        dec,
                        sha256(message)
                    ),
                    amt: 6n,
                },
            ]

            const { tx } = await BSV20P2PKH.transfer(
                bsv20P2PKHs,
                signer,
                recipients,
                address
            )

            console.log('transfer tx:', tx.id)
        }

        return expect(transferBSV20()).not.be.rejected
    })

    it('should transfer 2 BSV20P2PKH to 1 hashLock successfully: with different signer', async () => {
        const transferBSV20 = async () => {
            const feeSigner = getDefaultSigner()

            const [alicePrivateKey] = randomPrivateKey()
            const [bobPrivateKey] = randomPrivateKey()

            const aliceSigner = getDefaultSigner(alicePrivateKey)
            const bobSigner = getDefaultSigner(bobPrivateKey)

            const address = await feeSigner.getDefaultAddress()
            const bsv20P2PKHs = [
                dummyBSV20(
                    alicePrivateKey.toAddress(),
                    fromByteString(tick),
                    4n
                ),
                dummyBSV20(bobPrivateKey.toAddress(), fromByteString(tick), 5n),
            ].map((utxo) => BSV20P2PKH.fromUTXO(utxo))

            const message = toByteString('hello, sCrypt!', true)

            await bsv20P2PKHs[0].connect(aliceSigner)
            await bsv20P2PKHs[1].connect(bobSigner)

            const recipients: Array<FTReceiver> = [
                {
                    instance: new HashLockFT(
                        tick,
                        max,
                        lim,
                        dec,
                        sha256(message)
                    ),
                    amt: 6n,
                },
            ]

            const { tx } = await BSV20P2PKH.transfer(
                bsv20P2PKHs,
                feeSigner,
                recipients,
                address
            )

            console.log('transfer tx:', tx.id)
        }

        return expect(transferBSV20()).not.be.rejected
    })

    it('should transfer 2 BSV20P2PKH to 2 hashLock successfully.', async () => {
        const transferBSV20 = async () => {
            const signer = getDefaultSigner()
            const address = await signer.getDefaultAddress()
            const bsv20P2PKHs = [
                dummyBSV20(address, fromByteString(tick), 4n),
                dummyBSV20(address, fromByteString(tick), 5n),
            ].map((utxo) => BSV20P2PKH.fromUTXO(utxo))

            await Promise.all(bsv20P2PKHs.map((p) => p.connect(signer)))

            const message1 = toByteString('1:hello, sCrypt!', true)
            const message2 = toByteString('2:hello, sCrypt!', true)

            const recipients: Array<FTReceiver> = [
                {
                    instance: new HashLockFT(
                        tick,
                        max,
                        lim,
                        dec,
                        sha256(message1)
                    ),
                    amt: 6n,
                },
                {
                    instance: new HashLockFT(
                        tick,
                        max,
                        lim,
                        dec,
                        sha256(message2)
                    ),
                    amt: 3n,
                },
            ]

            const { tx } = await BSV20P2PKH.transfer(
                bsv20P2PKHs,
                signer,
                recipients,
                address
            )

            console.log('transfer tx:', tx.id)
        }

        return expect(transferBSV20()).not.be.rejected
    })

    it('should transfer 1 BSV20P2PKH and 1 hashLock to 1 hashLock successfully.', async () => {
        const transferBSV20 = async () => {
            const message1 = toByteString('1:hello, sCrypt!', true)
            const message2 = toByteString('2:hello, sCrypt!', true)

            const signer = getDefaultSigner()
            const address = await signer.getDefaultAddress()
            const sender0: BSV20P2PKH = BSV20P2PKH.fromUTXO(
                dummyBSV20(address, fromByteString(tick), 4n)
            )

            await sender0.connect(signer)

            const sender1 = new HashLockFT(
                tick,
                max,
                lim,
                dec,
                sha256(message1)
            )
            await sender1.connect(signer)
            await sender1.mint(5n)

            const recipients: Array<FTReceiver> = [
                {
                    instance: new HashLockFT(
                        tick,
                        max,
                        lim,
                        dec,
                        sha256(message1)
                    ),
                    amt: 6n,
                },
                {
                    instance: new HashLockFT(
                        tick,
                        max,
                        lim,
                        dec,
                        sha256(message2)
                    ),
                    amt: 3n,
                },
            ]

            const totalTokenAmt = sender0.getAmt() + sender1.getAmt()

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
                async (current: BSV20P2PKH): Promise<ContractTransaction> => {
                    const tx = new bsv.Transaction()
                    const nexts: StatefulNext<SmartContract>[] = []

                    for (let i = 0; i < recipients.length; i++) {
                        const receiver = recipients[i]

                        if (receiver.instance instanceof BSV20) {
                            receiver.instance.setAmt(receiver.amt)
                        } else {
                            throw new Error('unsupport receiver, only BSV20!')
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
                        const p2pkh = new BSV20P2PKH(
                            tick,
                            max,
                            lim,
                            dec,
                            Addr(ordPubKey.toAddress().toByteString())
                        )

                        p2pkh.setAmt(tokenChangeAmt)

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
                PubKey(ordPubKey.toByteString()),
                {
                    transfer: [],
                    pubKeyOrAddrToSign: ordPubKey,
                    multiContractCall: true,
                } as OrdiMethodCallOptions<BSV20P2PKH>
            )

            sender1.bindTxBuilder(
                'unlock',
                async (
                    current: HashLockFT,
                    options: MethodCallOptions<HashLockFT>
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
            } as OrdiMethodCallOptions<BSV20P2PKH>)

            const { tx } = await SmartContract.multiContractCall(
                partialContractTx,
                signer
            )

            console.log('transfer tx:', tx.id)
        }

        return expect(transferBSV20()).not.be.rejected
    })
})
