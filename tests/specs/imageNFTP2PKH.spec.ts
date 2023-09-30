import { expect, use } from 'chai'
import { Addr, PubKey, findSig } from 'scrypt-ts'
import { HashPuzzleNFT } from '../contracts/hashPuzzleNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OrdNFTP2PKH } from '../scrypt-ord'
import { readFileSync } from 'fs'
import { join } from 'path'
use(chaiAsPromised)

describe('Test mint a image NFT to `OrdNFTP2PKH`', () => {
    let instance: OrdNFTP2PKH

    before(async () => {
        HashPuzzleNFT.loadArtifact()
    })

    it('should pass when transfer NFT', async () => {
        const signer = getDefaultSigner()
        const ordAddress = await signer.getDefaultAddress()

        instance = new OrdNFTP2PKH(Addr(ordAddress.toByteString()))
        await instance.connect(signer)
        const bb = readFileSync(
            join(__dirname, '..', '..', 'logo.png')
        ).toString('base64')
        const tx = await instance.mintImageNft(bb, 'image/png')
        console.log('mint tx: ', tx.id)

        const call = async () => {
            const ordPubKey = await instance.signer.getDefaultPubKey()

            const { tx } = await instance.methods.unlock(
                (sigResps) => findSig(sigResps, ordPubKey),
                PubKey(ordPubKey.toByteString()),
                {
                    pubKeyOrAddrToSign: ordPubKey,
                    transfer: new OrdNFTP2PKH(Addr(ordAddress.toByteString())),
                }
            )
            console.log('transfer tx: ', tx.id)
        }

        await expect(call()).not.to.be.rejected
    })
})
