import { expect, use } from 'chai'
import { sha256, toByteString, bsv, Addr } from 'scrypt-ts'
import { HashPuzzleNFT } from '../contracts/hashPuzzleNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OneSatNFTP2PKH } from '../scrypt-ord'
import { myAddress } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test fromTx for SmartContract `HashPuzzleNFT`', () => {
    const message = toByteString('Hello sCrypt', true)

    let deployTx: bsv.Transaction
    const deployOutputIndex = 0

    before(async () => {
        HashPuzzleNFT.loadArtifact()
        const hash = sha256(message)
        const hashPuzzle = new HashPuzzleNFT(hash)
        await hashPuzzle.connect(getDefaultSigner())
        deployTx = await hashPuzzle.mintTextNft('Hello World')
    })

    it('should unlock successfully after instance recovery', async () => {
        // create instance from deploy tx
        const hashPuzzle = HashPuzzleNFT.fromTx(
            deployTx,
            deployOutputIndex
        ) as HashPuzzleNFT
        await hashPuzzle.connect(getDefaultSigner())

        const addr = Addr(myAddress.toByteString())
        const receiver = new OneSatNFTP2PKH(addr)
        const call = async () =>
            await hashPuzzle.methods.unlock(message, {
                transfer: receiver,
            })
        await expect(call()).not.to.be.rejected
    })
})
