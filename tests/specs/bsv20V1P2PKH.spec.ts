import { expect, use } from 'chai'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20P2PKH } from '../scrypt-ord'
import { PubKey, findSig, Addr, toByteString } from 'scrypt-ts'
import { dummyBSV20 } from './utils'
use(chaiAsPromised)

describe('Test SmartContract `BSV20P2PKH`', () => {
    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = max / 10n
    const dec = 0n

    describe('hold bsv20', () => {
        const amt = 1000n

        let instance: BSV20P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const address = await signer.getDefaultAddress()
            instance = new BSV20P2PKH(
                tick,
                max,
                lim,
                dec,
                Addr(address.toByteString())
            )
            await instance.connect(getDefaultSigner())
            await instance.deployToken()
            await instance.mint(amt)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()
                const ordPubKey = await signer.getDefaultPubKey()

                const recipients = [
                    {
                        instance: new BSV20P2PKH(
                            tick,
                            max,
                            lim,
                            dec,
                            Addr(address.toByteString())
                        ),
                        amt: 100n,
                    },
                ]
                const { tx } = await instance.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(ordPubKey.toByteString()),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: recipients,
                    }
                )

                console.log('transfer tx: ', tx.id)

                const receiver = recipients[0].instance

                expect(receiver.getAmt()).to.equal(100n)
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('from v1 utxo', () => {
        let instance: BSV20P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            // put bsv20 inscription script at the end of locking script
            instance = BSV20P2PKH.fromUTXO(
                dummyBSV20(addr, 'OOO1', 1n, false)
            )

            await instance.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()

                const ordPubKey = await signer.getDefaultPubKey()
                const recipients = [
                    {
                        instance: new BSV20P2PKH(
                            tick,
                            max,
                            lim,
                            dec,
                            Addr(address.toByteString())
                        ),
                        amt: 1n,
                    },
                ]
                const { tx } = await instance.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(ordPubKey.toByteString()),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: recipients,
                    }
                )

                console.log('transfer tx: ', tx.id)
                const receiver = recipients[0].instance as BSV20P2PKH

                expect(receiver.getAmt()).to.equal(1n)
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('from v2 utxo', () => {
        let instance: BSV20P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            instance = BSV20P2PKH.fromUTXO(dummyBSV20(addr, tick, 6n))

            await instance.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()
                const recipients = [
                    {
                        instance: new BSV20P2PKH(
                            tick,
                            max,
                            lim,
                            dec,
                            Addr(address.toByteString())
                        ),
                        amt: 2n,
                    },
                ]
                const ordPubKey = await signer.getDefaultPubKey()
                const { tx } = await instance.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(ordPubKey.toByteString()),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: recipients,
                    }
                )

                console.log('transfer tx: ', tx.id)
                const receiver = recipients[0].instance as BSV20P2PKH

                expect(receiver.getAmt()).to.equal(2n)
            }

            await expect(callContract()).not.rejected
        })
    })
})
