/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'

import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { OneSatNFTP2PKH } from '../scrypt-ord'
import { PubKey, findSig, toHex, Addr } from 'scrypt-ts'
import { dummyNFT, dummyP2PKH } from './utils'
use(chaiAsPromised)

describe('Test SmartContract `OneSatNFTP2PKH`', () => {
    describe('hold NFT', () => {
        let nftP2PKH: OneSatNFTP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const address = await signer.getDefaultAddress()
            nftP2PKH = new OneSatNFTP2PKH(Addr(address.toByteString()))
            await nftP2PKH.connect(signer)
            const tx = await nftP2PKH.mint({
                content: 'hello, sCrypt!',
                contentType: 'text/plain',
            })
            console.log('mint tx:', tx.id)
        })

        it('nft transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()

                const ordPubKey = await signer.getDefaultPubKey()
                const { tx } = await nftP2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(ordPubKey.toByteString()),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: new OneSatNFTP2PKH(
                            Addr(address.toByteString())
                        ),
                    }
                )

                console.log('transfer tx: ', tx.id)
            }
            await expect(callContract()).not.rejected
        })
    })

    describe('from  utxo nft append', () => {
        let nftP2PKH: OneSatNFTP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            nftP2PKH = OneSatNFTP2PKH.fromUTXO(
                dummyNFT(addr, 'hello, scrypt', false)
            )
            await nftP2PKH.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()

                const ordPubKey = await signer.getDefaultPubKey()
                const { tx } = await nftP2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(ordPubKey.toByteString()),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: new OneSatNFTP2PKH(
                            Addr(address.toByteString())
                        ),
                    }
                )

                console.log('transfer tx: ', tx.id)
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('from  utxo nft prepend', () => {
        let nftP2PKH: OneSatNFTP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            nftP2PKH = OneSatNFTP2PKH.fromUTXO(dummyNFT(addr, 'hello workd'))

            await nftP2PKH.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()

                const ordPubKey = await signer.getDefaultPubKey()
                const { tx } = await nftP2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(ordPubKey.toByteString()),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: new OneSatNFTP2PKH(
                            Addr(address.toByteString())
                        ),
                    }
                )

                console.log('transfer tx: ', tx.id)
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('from  utxo without nft in script', () => {
        let nftP2PKH: OneSatNFTP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            nftP2PKH = OneSatNFTP2PKH.fromUTXO(dummyP2PKH(addr))
            await nftP2PKH.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()

                const ordPubKey = await signer.getDefaultPubKey()
                const { tx } = await nftP2PKH.methods.unlock(
                    (sigResps) => findSig(sigResps, ordPubKey),
                    PubKey(ordPubKey.toByteString()),
                    {
                        pubKeyOrAddrToSign: ordPubKey,
                        transfer: new OneSatNFTP2PKH(
                            Addr(address.toByteString())
                        ),
                    }
                )

                console.log('transfer tx: ', tx.id)
            }

            await expect(callContract()).not.rejected
        })
    })
})
