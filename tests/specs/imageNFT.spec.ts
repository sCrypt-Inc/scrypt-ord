import { expect, use } from 'chai'
import { Addr, sha256, toByteString } from 'scrypt-ts'
import { HashPuzzleNFT } from '../contracts/hashPuzzleNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH } from '../scrypt-ord'
import { readFileSync } from 'fs'
import { join } from 'path'
use(chaiAsPromised)

describe('Test mint a image NFT to `HashPuzzleNFT`', () => {
    const text = 'Hello sCrypt and 1Sat Oridinals'
    const message = toByteString(text, true)
    const hash = sha256(message)

    let instance: HashPuzzleNFT

    before(async () => {
        HashPuzzleNFT.loadArtifact()
        instance = new HashPuzzleNFT(hash)
        await instance.connect(getDefaultSigner())
        const bb = readFileSync(
            join(__dirname, '..', '..', 'logo.png')
        ).toString('base64')
        const tx = await instance.mintImageNft(bb, 'image/png')
        console.log('mint tx: ', tx.id)
    })

    it('should pass when transfer NFT', async () => {
        const ordAddress = await instance.signer.getDefaultAddress()
        const call = async () =>
            await instance.methods.unlock(message, {
                transfer: new OrdP2PKH(Addr(ordAddress.toByteString())),
            })
        await expect(call()).not.to.be.rejected
    })
})