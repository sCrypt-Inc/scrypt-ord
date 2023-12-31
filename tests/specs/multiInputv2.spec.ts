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
import { HashLockFTV2 } from '../contracts/hashLockFTV2'
import { getDefaultSigner, randomPrivateKey } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import {
    BSV20V2,
    BSV20V2P2PKH,
    FTReceiver,
    OrdiMethodCallOptions,
} from '../scrypt-ord'
import { dummyBSV20V2 } from './utils'
use(chaiAsPromised)

describe('Test SmartContract `HashLockFTV2 multi inputs`', () => {
    const max = 100000n
    const dec = 0n
    const sym = toByteString('MEME', true)

    let hashLock: HashLockFTV2
    let tokenId: string
    before(async () => {
        HashLockFTV2.loadArtifact()
        hashLock = new HashLockFTV2(
            toByteString(''),
            sym,
            max,
            dec,
            sha256(toByteString('hello, sCrypt!:0', true))
        )
        await hashLock.connect(getDefaultSigner())

        tokenId = await hashLock.deployToken()
        console.log('token id: ', tokenId)
    })

    it('should transfer 2 BSV20V2P2PKH to 1 hashLock successfully: with different signer', async () => {
        const transferBSV20 = async () => {
            const feeSigner = getDefaultSigner()

            const [alicePrivateKey] = randomPrivateKey()
            const [bobPrivateKey] = randomPrivateKey()

            const aliceSigner = getDefaultSigner(alicePrivateKey)
            const bobSigner = getDefaultSigner(bobPrivateKey)

            const address = await feeSigner.getDefaultAddress()
            const bsv20V1P2PKHs = [
                dummyBSV20V2(alicePrivateKey.toAddress(), tokenId, 4n),
                dummyBSV20V2(bobPrivateKey.toAddress(), tokenId, 5n),
            ].map((utxo) => BSV20V2P2PKH.fromUTXO(utxo))

            const message = toByteString('hello, sCrypt!', true)

            await bsv20V1P2PKHs[0].connect(aliceSigner)
            await bsv20V1P2PKHs[1].connect(bobSigner)

            const recipients: Array<FTReceiver> = [
                {
                    instance: new HashLockFTV2(
                        toByteString(tokenId, true),
                        sym,
                        max,
                        dec,
                        sha256(message)
                    ),
                    amt: 6n,
                },
            ]

            const { tx } = await BSV20V2P2PKH.transfer(
                bsv20V1P2PKHs,
                feeSigner,
                recipients,
                address
            )

            console.log('transfer tx:', tx.id)
        }

        return expect(transferBSV20()).not.be.rejected
    })

    it('transfer to an other hashLock with change.', async () => {
        const callContract = async () => {
            const receiver = new HashLockFTV2(
                toByteString(tokenId, true),
                sym,
                max,
                dec,
                sha256(toByteString(`hello, sCrypt!:1`, true))
            )

            const recipients: Array<FTReceiver> = [
                {
                    instance: receiver,
                    amt: 1000n,
                },
            ]

            const { tx, nexts } = await hashLock.methods.unlock(
                toByteString(`hello, sCrypt!:0`, true),
                {
                    transfer: recipients,
                } as OrdiMethodCallOptions<HashLockFTV2>
            )

            console.log('transfer tx: ', tx.id)

            expect(nexts.length === 2).to.be.true

            const p2pkh = nexts[1].instance as BSV20V2P2PKH

            expect(p2pkh.getAmt()).to.be.equal(99000n)

            const sender0 = nexts[0].instance
            const sender1 = nexts[1].instance

            await sender0.connect(getDefaultSigner())
            await sender1.connect(getDefaultSigner())

            const totalTokenAmt = sender0.getAmt() + sender1.getAmt()

            const tokenAmt = 5000n

            const ordPubKey = await sender0.signer.getDefaultPubKey()

            const tokenChangeAmt = totalTokenAmt - tokenAmt

            if (tokenChangeAmt < 0n) {
                throw new Error('Not enough token!')
            }

            sender0.bindTxBuilder(
                'unlock',
                async (current: HashLockFTV2): Promise<ContractTransaction> => {
                    const tx = new bsv.Transaction()
                    const nexts: StatefulNext<SmartContract>[] = []

                    for (let i = 0; i < recipients.length; i++) {
                        const receiver = recipients[i]

                        if (receiver.instance instanceof BSV20V2) {
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
                        const p2pkh = new BSV20V2P2PKH(
                            toByteString(tokenId, true),
                            sym,
                            max,
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
                toByteString('hello, sCrypt!:1', true),
                {
                    transfer: [
                        {
                            instance: receiver,
                            amt: tokenAmt,
                        },
                    ],
                    pubKeyOrAddrToSign: ordPubKey,
                    multiContractCall: true,
                } as OrdiMethodCallOptions<BSV20V2P2PKH>
            )

            sender1.bindTxBuilder(
                'unlock',
                async (
                    current: HashLockFTV2,
                    options: MethodCallOptions<HashLockFTV2>
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

            partialContractTx = await sender1.methods.unlock(
                (sigResps) => findSig(sigResps, ordPubKey),
                PubKey(ordPubKey.toByteString()),
                {
                    partialContractTx,
                    transfer: recipients,
                    pubKeyOrAddrToSign: ordPubKey,
                    multiContractCall: true,
                } as OrdiMethodCallOptions<BSV20V2P2PKH>
            )

            const { tx: finalTx } = await SmartContract.multiContractCall(
                partialContractTx,
                getDefaultSigner()
            )

            console.log('finalTx tx:', finalTx.id)
        }

        await expect(callContract()).not.rejected
    })
})
