/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'

import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH } from '../scrypt-ord'
import { PubKey, findSig, toHex } from 'scrypt-ts'
import { dummybsv20V1, dummybsv20V2 } from './utils'
use(chaiAsPromised)

describe('Test SmartContract `OrdP2PKH`', () => {
    describe('hold bsv20', () => {
        const tick = 'DOGE'

        let ordP2PKH: OrdP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const address = await signer.getDefaultAddress()
            ordP2PKH = OrdP2PKH.fromAddress(address)
            ordP2PKH.setBSV20(tick, 1000n)
            await ordP2PKH.connect(getDefaultSigner())
            await ordP2PKH.deploy(1)
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
                                instance: OrdP2PKH.fromAddress(address),
                                amt: 100n,
                            },
                        ],
                    }
                )

                console.log('transfer tx: ', tx.id)

                const receiver = nexts[0].instance as OrdP2PKH

                expect(receiver.getBSV20Amt()).to.equal(100n)

                const tokenChangeP2PKH = nexts[1].instance as OrdP2PKH

                expect(tokenChangeP2PKH).not.to.be.null

                if (tokenChangeP2PKH) {
                    expect(tokenChangeP2PKH.getBSV20Amt()).to.equal(900n)
                }
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('hold NFT', () => {
        let ordP2PKH: OrdP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const address = await signer.getDefaultAddress()
            ordP2PKH = OrdP2PKH.fromAddress(address)
            ordP2PKH.setNFT({
                content: 'hello, sCrypt!',
                contentType: 'text/plain',
            })
            await ordP2PKH.connect(signer)
            await ordP2PKH.deploy(1)
        })

        it('nft transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()

                const ordPubKey = await signer.getDefaultPubKey()
                const { tx, nexts } = await ordP2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(toHex(ordPubKey)),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: OrdP2PKH.fromAddress(address),
                    }
                )

                console.log('transfer tx: ', tx.id)
            }
            await expect(callContract()).not.rejected
        })
    })

    describe('from v1 utxo', () => {
        let ordP2PKH: OrdP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            ordP2PKH = OrdP2PKH.fromBsv20P2PKH(dummybsv20V1(addr, 'OOO1', 1n))

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
                                instance: OrdP2PKH.fromAddress(address),
                                amt: 1n,
                            },
                        ],
                    }
                )

                console.log('transfer tx: ', tx.id)
                const receiver = nexts[0].instance as OrdP2PKH

                expect(receiver.getBSV20Amt()).to.equal(1n)

                expect(nexts.length === 1).to.be.true
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('from v2 utxo', () => {
        let ordP2PKH: OrdP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            ordP2PKH = OrdP2PKH.fromBsv20P2PKH(dummybsv20V1(addr, 'OOO1', 6n))

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
                                instance: OrdP2PKH.fromAddress(address),
                                amt: 2n,
                            },
                        ],
                    }
                )

                console.log('transfer tx: ', tx.id)
                const receiver = nexts[0].instance as OrdP2PKH

                expect(receiver.getBSV20Amt()).to.equal(2n)

                expect(nexts.length === 2).to.be.true

                const change = nexts[1].instance as OrdP2PKH

                expect(change.getBSV20Amt()).to.equal(4n)
            }

            await expect(callContract()).not.rejected
        })
    })
})
