import { expect, use } from 'chai'
import {
    Addr,
    MethodCallOptions,
    PubKey,
    findSig,
    sha256,
    toByteString,
} from 'scrypt-ts'
import { HashPuzzleNFT } from '../contracts/hashPuzzleNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OneSatNFTP2PKH } from '../scrypt-ord'
import { dummyP2PKH, dummyNFT } from './utils'
use(chaiAsPromised)

describe('Test SmartContract send NFT to `HashPuzzleNFT`', () => {
    describe('p2pkh with post NFT', () => {
        const text = 'Hello sCrypt and 1Sat Ordinals'
        const message = toByteString(text, true)
        const hash = sha256(message)

        let recipient: HashPuzzleNFT

        const signer = getDefaultSigner()

        before(async () => {
            HashPuzzleNFT.loadArtifact()
            recipient = new HashPuzzleNFT(hash)
            await recipient.connect(signer)
        })

        it('transfer exist NFT to a HashPuzzle', async () => {
            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            // create p2pkh from a utxo
            const p2pkh = OneSatNFTP2PKH.fromUTXO(
                dummyNFT(address, 'hello world')
            )
            // or create p2pkh from origin
            // const p2pkh = OneSatNFTP2PKH.getLatestInstance(`origin`);

            await p2pkh.connect(signer)

            const { tx: transferTx } = await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: recipient,
                    pubKeyOrAddrToSign: pubkey,
                } as MethodCallOptions<OneSatNFTP2PKH>
            )

            console.log('transfer NFT: ', transferTx.id)
        })

        it('should pass when transfer NFT', async () => {
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () =>
                await recipient.methods.unlock(message, {
                    transfer: new OneSatNFTP2PKH(
                        Addr(ordAddress.toByteString())
                    ),
                })
            await expect(call()).not.to.be.rejected
        })
    })

    describe('p2pkh with prepend NFT', () => {
        const text = 'Hello sCrypt and 1Sat Ordinals'
        const message = toByteString(text, true)
        const hash = sha256(message)

        let recipient: HashPuzzleNFT

        const signer = getDefaultSigner()

        before(async () => {
            HashPuzzleNFT.loadArtifact()
            recipient = new HashPuzzleNFT(hash)
            await recipient.connect(signer)
        })

        it('transfer exist NFT to a HashPuzzle', async () => {
            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            // create p2pkh from a utxo
            const p2pkh = OneSatNFTP2PKH.fromUTXO(
                dummyNFT(address, 'hello world')
            )
            // or create p2pkh from origin
            // const p2pkh = OneSatNFTP2PKH.getLatestInstance(`origin`);

            await p2pkh.connect(signer)

            const { tx: transferTx } = await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: recipient,
                    pubKeyOrAddrToSign: pubkey,
                } as MethodCallOptions<OneSatNFTP2PKH>
            )

            console.log('transfer NFT: ', transferTx.id)
        })

        it('should pass when transfer NFT', async () => {
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () =>
                await recipient.methods.unlock(message, {
                    transfer: new OneSatNFTP2PKH(
                        Addr(ordAddress.toByteString())
                    ),
                })
            await expect(call()).not.to.be.rejected
        })
    })

    describe('p2pkh without NFT inscription', () => {
        const text = 'Hello sCrypt and 1Sat Ordinals'
        const message = toByteString(text, true)
        const hash = sha256(message)

        let recipient: HashPuzzleNFT

        const signer = getDefaultSigner()

        before(async () => {
            HashPuzzleNFT.loadArtifact()
            recipient = new HashPuzzleNFT(hash)
            await recipient.connect(signer)
        })

        it('transfer exist NFT to a HashPuzzle', async () => {
            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            // create p2pkh from a utxo
            const p2pkh = OneSatNFTP2PKH.fromUTXO(dummyP2PKH(address))
            // or create p2pkh from origin
            // const p2pkh = OneSatNFTP2PKH.getLatestInstance(`origin`);

            await p2pkh.connect(signer)

            const { tx: transferTx } = await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: recipient,
                    pubKeyOrAddrToSign: pubkey,
                } as MethodCallOptions<OneSatNFTP2PKH>
            )

            console.log('transfer NFT: ', transferTx.id)
        })

        it('should pass when transfer NFT', async () => {
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () =>
                await recipient.methods.unlock(message, {
                    transfer: new OneSatNFTP2PKH(
                        Addr(ordAddress.toByteString())
                    ),
                })
            await expect(call()).not.to.be.rejected
        })
    })
})
