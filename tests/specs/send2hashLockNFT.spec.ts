import { expect, use } from 'chai'
import { Addr, PubKey, findSig, sha256, toByteString } from 'scrypt-ts'
import { HashLockNFT } from '../contracts/hashLockNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OrdiMethodCallOptions, OrdiNFTP2PKH } from '../scrypt-ord'
import { dummyP2PKH, dummyNFT } from './utils'
use(chaiAsPromised)

describe('Test SmartContract send NFT to `HashLockNFT`', () => {
    describe('p2pkh with post NFT', () => {
        const text = 'Hello sCrypt and 1Sat Ordinals'
        const message = toByteString(text, true)
        const hash = sha256(message)

        let recipient: HashLockNFT

        const signer = getDefaultSigner()

        before(async () => {
            HashLockNFT.loadArtifact()
            recipient = new HashLockNFT(hash)
        })

        it('transfer exist NFT to a HashLock', async () => {
            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            // create p2pkh from a utxo
            const p2pkh = OrdiNFTP2PKH.fromUTXO(
                dummyNFT(address, 'hello world')
            )
            // or create p2pkh from origin
            // const p2pkh = OrdiNFTP2PKH.getLatestInstance(`origin`);

            await p2pkh.connect(signer)

            const { tx: transferTx } = await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: recipient,
                    pubKeyOrAddrToSign: pubkey,
                } as OrdiMethodCallOptions<OrdiNFTP2PKH>
            )

            console.log('transfer NFT: ', transferTx.id)
        })

        it('should pass when transfer NFT', async () => {
            await recipient.connect(signer)
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () =>
                await recipient.methods.unlock(message, {
                    transfer: new OrdiNFTP2PKH(Addr(ordAddress.toByteString())),
                })
            await expect(call()).not.to.be.rejected
        })
    })

    describe('p2pkh with prepend NFT', () => {
        const text = 'Hello sCrypt and 1Sat Ordinals'
        const message = toByteString(text, true)
        const hash = sha256(message)

        let recipient: HashLockNFT

        const signer = getDefaultSigner()

        before(async () => {
            HashLockNFT.loadArtifact()
            recipient = new HashLockNFT(hash)
        })

        it('transfer exist NFT to a HashLock', async () => {
            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            // create p2pkh from a utxo
            const p2pkh = OrdiNFTP2PKH.fromUTXO(
                dummyNFT(address, 'hello world')
            )
            // or create p2pkh from origin
            // const p2pkh = OrdiNFTP2PKH.getLatestInstance(`origin`);

            await p2pkh.connect(signer)

            const { tx: transferTx } = await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: recipient,
                    pubKeyOrAddrToSign: pubkey,
                } as OrdiMethodCallOptions<OrdiNFTP2PKH>
            )

            console.log('transfer NFT: ', transferTx.id)
        })

        it('should pass when transfer NFT', async () => {
            await recipient.connect(signer)
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () =>
                await recipient.methods.unlock(message, {
                    transfer: new OrdiNFTP2PKH(Addr(ordAddress.toByteString())),
                })
            await expect(call()).not.to.be.rejected
        })
    })

    describe('p2pkh without NFT inscription', () => {
        const text = 'Hello sCrypt and 1Sat Ordinals'
        const message = toByteString(text, true)
        const hash = sha256(message)

        let recipient: HashLockNFT

        const signer = getDefaultSigner()

        before(async () => {
            HashLockNFT.loadArtifact()
            recipient = new HashLockNFT(hash)
        })

        it('transfer exist NFT to a HashLock', async () => {
            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            // create p2pkh from a utxo
            const p2pkh = OrdiNFTP2PKH.fromUTXO(dummyP2PKH(address))
            // or create p2pkh from origin
            // const p2pkh = OrdiNFTP2PKH.getLatestInstance(`origin`);

            await p2pkh.connect(signer)

            const { tx: transferTx } = await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: recipient,
                    pubKeyOrAddrToSign: pubkey,
                } as OrdiMethodCallOptions<OrdiNFTP2PKH>
            )

            console.log('transfer NFT: ', transferTx.id)
        })

        it('should pass when transfer NFT', async () => {
            await recipient.connect(signer)
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () =>
                await recipient.methods.unlock(message, {
                    transfer: new OrdiNFTP2PKH(Addr(ordAddress.toByteString())),
                })
            await expect(call()).not.to.be.rejected
        })
    })
})
