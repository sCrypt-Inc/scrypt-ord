import { expect, use } from 'chai'
import { sha256, toByteString, bsv, Addr } from 'scrypt-ts'
import { HashPuzzleFT } from '../contracts/hashPuzzleFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20V1P2PKH } from '../scrypt-ord'
import { myAddress } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test fromTx for SmartContract `HashPuzzleFT`', () => {
    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = max / 10n
    const dec = 0n

    const message = toByteString('Hello sCrypt', true)

    let deployTx: bsv.Transaction
    const deployOutputIndex = 0

    before(async () => {
        HashPuzzleFT.loadArtifact()
        const hash = sha256(message)
        const hashPuzzle = new HashPuzzleFT(tick, max, lim, dec, hash)
        await hashPuzzle.connect(getDefaultSigner())
        await hashPuzzle.deployToken()
        deployTx = await hashPuzzle.mint(100n)
    })

    it('should unlock successfully after instance recovery', async () => {
        // create instance from deploy tx
        const hashPuzzle = HashPuzzleFT.fromTx(deployTx, deployOutputIndex)
        await hashPuzzle.connect(getDefaultSigner())

        const addr = Addr(myAddress.toByteString())
        const receiver = new BSV20V1P2PKH(tick, max, lim, dec, addr)
        const call = async () =>
            await hashPuzzle.methods.unlock(message, {
                transfer: {
                    instance: receiver,
                    amt: 10n,
                },
            })
        await expect(call()).not.to.be.rejected
    })
})
