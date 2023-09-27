/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'

import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { BSV20V2P2PKH } from '../scrypt-ord'
import {
    PubKey,
    findSig,
    toHex,
    Addr,
    toByteString,
    fromByteString,
    ByteString,
} from 'scrypt-ts'
import { dummyBSV20, dummyBSV20V2 } from './utils'
use(chaiAsPromised)

describe('Test SmartContract `BSV20V2P2PKH`', () => {
    let tokenId: ByteString
    const max = 100000n
    const dec = 0n

    describe('hold bsv20', () => {
        let bsv20V2P2PKH: BSV20V2P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const address = await signer.getDefaultAddress()
            bsv20V2P2PKH = new BSV20V2P2PKH(
                toByteString(''),
                max,
                dec,
                Addr(address.toByteString())
            )
            await bsv20V2P2PKH.connect(getDefaultSigner())
            const tokenIdStr = await bsv20V2P2PKH.deployToken()
            tokenId = toByteString(tokenIdStr, true)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()
                const ordPubKey = await signer.getDefaultPubKey()

                const recipients = [
                    {
                        instance: new BSV20V2P2PKH(
                            tokenId,
                            max,
                            dec,
                            Addr(address.toByteString())
                        ),
                        amt: 100n,
                    },
                ]
                const { tx } = await bsv20V2P2PKH.methods.unlock(
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
        let bsv20V2P2PKH: BSV20V2P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            // put bsv20 inscription script at the end of locking script
            bsv20V2P2PKH = BSV20V2P2PKH.fromUTXO(
                dummyBSV20V2(addr, fromByteString(tokenId), 1n, false)
            )

            await bsv20V2P2PKH.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()

                const ordPubKey = await signer.getDefaultPubKey()
                const recipients = [
                    {
                        instance: new BSV20V2P2PKH(
                            tokenId,
                            max,
                            dec,
                            Addr(address.toByteString())
                        ),
                        amt: 1n,
                    },
                ]
                const { tx } = await bsv20V2P2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(ordPubKey.toByteString()),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: recipients,
                    }
                )

                console.log('transfer tx: ', tx.id)
                const receiver = recipients[0].instance as BSV20V2P2PKH

                expect(receiver.getAmt()).to.equal(1n)
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('from v2 utxo', () => {
        let bsv20P2PKH: BSV20V2P2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            bsv20P2PKH = BSV20V2P2PKH.fromUTXO(
                dummyBSV20V2(addr, fromByteString(tokenId), 6n)
            )

            await bsv20P2PKH.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()
                const recipients = [
                    {
                        instance: new BSV20V2P2PKH(
                            tokenId,
                            max,
                            dec,
                            Addr(address.toByteString())
                        ),
                        amt: 2n,
                    },
                ]
                const ordPubKey = await signer.getDefaultPubKey()
                const { tx } = await bsv20P2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(ordPubKey.toByteString()),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: recipients,
                    }
                )

                console.log('transfer tx: ', tx.id)
                const receiver = recipients[0].instance as BSV20V2P2PKH

                expect(receiver.getAmt()).to.equal(2n)
            }

            await expect(callContract()).not.rejected
        })
    })
})
