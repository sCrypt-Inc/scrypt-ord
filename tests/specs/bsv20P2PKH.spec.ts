/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'

import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { BSV20P2PKH } from '../scrypt-ord'
import { PubKey, findSig, toHex, Addr, toByteString } from 'scrypt-ts'
import { dummyBSV20 } from './utils'
use(chaiAsPromised)

describe('Test SmartContract `BSV20P2PKH`', () => {
    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = max / 10n

    describe('hold bsv20', () => {
        const amt = 1000n

        let bsv20P2PKH: BSV20P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const address = await signer.getDefaultAddress()
            bsv20P2PKH = new BSV20P2PKH(
                tick,
                max,
                lim,
                Addr(address.toByteString())
            )
            await bsv20P2PKH.connect(getDefaultSigner())
            await bsv20P2PKH.deployToken()
            await bsv20P2PKH.mint(amt)
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
                            Addr(address.toByteString())
                        ),
                        amt: 100n,
                    },
                ]
                const { tx } = await bsv20P2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(toHex(ordPubKey)),
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
        let bsv20P2PKH: BSV20P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            // put bsv20 inscription script at the end of locking script
            bsv20P2PKH = BSV20P2PKH.fromUTXO(
                dummyBSV20(addr, 'OOO1', 1n, false)
            )

            await bsv20P2PKH.connect(signer)
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
                            Addr(address.toByteString())
                        ),
                        amt: 1n,
                    },
                ]
                const { tx } = await bsv20P2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(toHex(ordPubKey)),
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
        let bsv20P2PKH: BSV20P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            bsv20P2PKH = BSV20P2PKH.fromUTXO(dummyBSV20(addr, tick, 6n))

            await bsv20P2PKH.connect(signer)
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
                            Addr(address.toByteString())
                        ),
                        amt: 2n,
                    },
                ]
                const ordPubKey = await signer.getDefaultPubKey()
                const { tx } = await bsv20P2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(toHex(ordPubKey)),
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
