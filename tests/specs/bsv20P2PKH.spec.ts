/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'

import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { BSV20P2PKH } from '../scrypt-ord'
import { PubKey, findSig, toHex, Addr, toByteString } from 'scrypt-ts'
import { dummybsv20 } from './utils'
use(chaiAsPromised)

describe('Test SmartContract `BSV20V1P2PKH`', () => {
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
                const { tx, nexts } = await bsv20P2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(toHex(ordPubKey)),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: [
                            {
                                instance: new BSV20P2PKH(
                                    tick,
                                    max,
                                    lim,
                                    Addr(address.toByteString())
                                ),
                                amt: 100n,
                            },
                        ],
                    }
                )

                console.log('transfer tx: ', tx.id)

                const receiver = nexts[0].instance as BSV20P2PKH

                expect(receiver.getAmt()).to.equal(100n)

                const tokenChangeP2PKH = nexts[1].instance as BSV20P2PKH

                expect(tokenChangeP2PKH).not.to.be.null

                if (tokenChangeP2PKH) {
                    expect(tokenChangeP2PKH.getAmt()).to.equal(900n)
                }
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('from v1 utxo', () => {
        let ordP2PKH: BSV20P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            ordP2PKH = BSV20P2PKH.fromUTXO(dummybsv20(addr, 'OOO1', 1n, false))

            await ordP2PKH.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()

                const ordPubKey = await signer.getDefaultPubKey()

                const { tx, nexts } = await ordP2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(toHex(ordPubKey)),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: [
                            {
                                instance: new BSV20P2PKH(
                                    tick,
                                    max,
                                    lim,
                                    Addr(address.toByteString())
                                ),
                                amt: 1n,
                            },
                        ],
                    }
                )

                console.log('transfer tx: ', tx.id)
                const receiver = nexts[0].instance as BSV20P2PKH

                expect(receiver.getAmt()).to.equal(1n)

                expect(nexts.length === 1).to.be.true
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('from v2 utxo', () => {
        let ordP2PKH: BSV20P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            ordP2PKH = BSV20P2PKH.fromUTXO(dummybsv20(addr, tick, 6n))

            await ordP2PKH.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()

                const ordPubKey = await signer.getDefaultPubKey()
                const { tx, nexts } = await ordP2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(toHex(ordPubKey)),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: [
                            {
                                instance: new BSV20P2PKH(
                                    tick,
                                    max,
                                    lim,
                                    Addr(address.toByteString())
                                ),
                                amt: 2n,
                            },
                        ],
                    }
                )

                console.log('transfer tx: ', tx.id)
                const receiver = nexts[0].instance as BSV20P2PKH

                expect(receiver.getAmt()).to.equal(2n)

                expect(nexts.length === 2).to.be.true

                const change = nexts[1].instance as BSV20P2PKH

                expect(change.getAmt()).to.equal(4n)
            }

            await expect(callContract()).not.rejected
        })
    })
})
