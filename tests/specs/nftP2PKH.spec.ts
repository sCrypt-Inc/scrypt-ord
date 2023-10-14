import { expect, use } from 'chai'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { ContentType, OrdiNFTP2PKH } from '../scrypt-ord'
import { PubKey, findSig, Addr } from 'scrypt-ts'
import { dummyNFT, dummyP2PKH } from './utils'
use(chaiAsPromised)

describe('Test SmartContract `OrdiNFTP2PKH`', () => {
    describe('hold NFT', () => {
        let nftP2PKH: OrdiNFTP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const address = await signer.getDefaultAddress()
            nftP2PKH = new OrdiNFTP2PKH(Addr(address.toByteString()))
            await nftP2PKH.connect(signer)
            const tx = await nftP2PKH.inscribe({
                content: 'hello, sCrypt!',
                contentType: ContentType.TEXT,
            })
            console.log('inscribed tx:', tx.id)
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
                        transfer: new OrdiNFTP2PKH(
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
        let nftP2PKH: OrdiNFTP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            nftP2PKH = OrdiNFTP2PKH.fromUTXO(
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
                        transfer: new OrdiNFTP2PKH(
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
        let nftP2PKH: OrdiNFTP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            nftP2PKH = OrdiNFTP2PKH.fromUTXO(dummyNFT(addr, 'hello workd'))

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
                        transfer: new OrdiNFTP2PKH(
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
        let nftP2PKH: OrdiNFTP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            nftP2PKH = OrdiNFTP2PKH.fromUTXO(dummyP2PKH(addr))
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
                        transfer: new OrdiNFTP2PKH(
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
