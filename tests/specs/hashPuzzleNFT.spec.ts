import { expect, use } from 'chai'
import { sha256, toByteString } from 'scrypt-ts'
import { HashPuzzleNFT } from '../contracts/hashPuzzleNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `HashPuzzleNFT`', () => {
    const text = 'Hello sCrypt and 1Sat Oridinals'
    const message = toByteString(text, true)
    const hash = sha256(message)

    let instance: HashPuzzleNFT

    before(async () => {
        HashPuzzleNFT.loadArtifact()
        instance = new HashPuzzleNFT(hash)
        await instance.connect(getDefaultSigner())
        await instance.mintTextNft(text)
    })

    it('should pass when calling `unlock`', async () => {
        const call = async () => await instance.methods.unlock(message)
        await expect(call()).not.to.be.rejected
    })

    it('should fail when passing incorrect message', async () => {
        const call = async () => await instance.methods.unlock(toByteString(''))
        await expect(call()).to.be.rejectedWith(/hashes are not equal/)
    })
})
