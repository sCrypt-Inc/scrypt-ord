import { expect, use } from 'chai'
import {
    Addr,
    MethodCallOptions,
    PubKey,
    findSig,
    sha256,
    toByteString,
} from 'scrypt-ts'
import { getDefaultSigner, randomPrivateKey } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20V1P2PKH, fromByteString } from '../scrypt-ord'
import { dummyBSV20 } from './utils'
import { HashPuzzleFT } from '../contracts/hashPuzzleFT'
use(chaiAsPromised)

describe('Test SmartContract send FT to `HashPuzzleFT`', () => {
    describe('p2pkh with post FT', () => {
        const tick = toByteString('DOGE', true)
        const max = 100000n
        const lim = max / 10n
        const dec = 0n

        const text = 'Hello sCrypt and 1Sat Ordinals'
        const message = toByteString(text, true)
        const hash = sha256(message)

        let recipient: HashPuzzleFT

        const signer = getDefaultSigner()

        before(async () => {
            HashPuzzleFT.loadArtifact()
            recipient = new HashPuzzleFT(tick, max, lim, dec, hash)
            await recipient.connect(signer)
        })

        it('transfer exist FT to a HashPuzzle', async () => {
            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            // create p2pkh from a utxo
            const p2pkh = BSV20V1P2PKH.fromUTXO(
                dummyBSV20(address, fromByteString(tick), 100n)
            )

            await p2pkh.connect(signer)

            const { tx: transferTx, nexts } = await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: [
                        {
                            instance: recipient,
                            amt: 15n,
                        },
                    ],
                    pubKeyOrAddrToSign: pubkey,
                } as MethodCallOptions<BSV20V1P2PKH>
            )

            console.log('transfer FT: ', transferTx.id)
            expect(nexts.length).to.equal(2)

            expect(recipient.getAmt()).to.equal(15n)

            const changeToken = nexts[1].instance as BSV20V1P2PKH

            expect(changeToken.getAmt()).to.equal(85n)
        })

        it('should fail when passing incorrect signature', async () => {
            const [wrongPrivKey, wrongPubKey, ,] = randomPrivateKey()

            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            const p2pkh = BSV20V1P2PKH.fromUTXO(
                dummyBSV20(address, fromByteString(tick), 100n)
            )

            signer.addPrivateKey(wrongPrivKey)
            await p2pkh.connect(signer)

            const call = async () =>
                await p2pkh.methods.unlock(
                    (sigResps) => findSig(sigResps, wrongPubKey),
                    PubKey(pubkey.toByteString()),
                    {
                        transfer: [
                            {
                                instance: recipient,
                                amt: 15n,
                            },
                        ],
                        pubKeyOrAddrToSign: wrongPubKey,
                    } as MethodCallOptions<BSV20V1P2PKH>
                )
            await expect(call()).to.be.rejectedWith(/signature check failed/)
        })

        it('transfer FT to a BSV20V1P2PKH', async () => {
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () => {
                const { tx, nexts } = await recipient.methods.unlock(message, {
                    transfer: [
                        {
                            instance: new BSV20V1P2PKH(
                                tick,
                                max,
                                lim,
                                dec,
                                Addr(ordAddress.toByteString())
                            ),
                            amt: 15n,
                        },
                    ],
                })

                console.log('transfer FT: ', tx.id)
                // no token change
                expect(nexts.length).to.equal(1)

                const p2pkh = nexts[0].instance as BSV20V1P2PKH

                expect(p2pkh.getAmt()).to.equal(15n)
            }

            await expect(call()).not.to.be.rejected
        })

        it('should fail when passing incorrect message', async () => {
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () =>
                await recipient.methods.unlock(
                    toByteString('incorrect message', true),
                    {
                        transfer: [
                            {
                                instance: new BSV20V1P2PKH(
                                    tick,
                                    max,
                                    lim,
                                    dec,
                                    Addr(ordAddress.toByteString())
                                ),
                                amt: 15n,
                            },
                        ],
                    }
                )
            await expect(call()).to.be.rejectedWith(/hashes are not equal/)
        })
    })

    describe('p2pkh with prepend FT', () => {
        const tick = toByteString('DOGE', true)
        const max = 100000n
        const lim = max / 10n
        const dec = 0n
        const text = 'Hello sCrypt and 1Sat Ordinals'
        const message = toByteString(text, true)
        const hash = sha256(message)

        let recipient: HashPuzzleFT

        const signer = getDefaultSigner()

        before(async () => {
            HashPuzzleFT.loadArtifact()
            recipient = new HashPuzzleFT(tick, max, lim, dec, hash)
            await recipient.connect(signer)
        })

        it('transfer exist FT to a HashPuzzle', async () => {
            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            // create p2pkh from a utxo
            const p2pkh = BSV20V1P2PKH.fromUTXO(
                dummyBSV20(address, fromByteString(tick), 100n)
            )

            await p2pkh.connect(signer)

            const { tx: transferTx } = await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: [
                        {
                            instance: recipient,
                            amt: 9n,
                        },
                    ],
                    pubKeyOrAddrToSign: pubkey,
                } as MethodCallOptions<BSV20V1P2PKH>
            )

            console.log('transfer FT: ', transferTx.id)
        })

        it('transfer FT to a BSV20V1P2PKH', async () => {
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () =>
                await recipient.methods.unlock(message, {
                    transfer: [
                        {
                            instance: new BSV20V1P2PKH(
                                tick,
                                max,
                                lim,
                                dec,
                                Addr(ordAddress.toByteString())
                            ),
                            amt: 9n,
                        },
                    ],
                })
            await expect(call()).not.to.be.rejected
        })
    })
})
