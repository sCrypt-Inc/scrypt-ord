import { expect, use } from 'chai'
import { sha256, toByteString, bsv, Addr } from 'scrypt-ts'
import { HashLockBSV20 } from '../contracts/hashLockBSV20'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20P2PKH } from '../scrypt-ord'
import { myAddress } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test fromTx for SmartContract `HashLockBSV20`', () => {
    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = max / 10n
    const dec = 0n

    const message = toByteString('Hello sCrypt', true)

    let deployTx: bsv.Transaction
    const deployOutputIndex = 0

    before(async () => {
        HashLockBSV20.loadArtifact()
        const hash = sha256(message)
        const hashLock = new HashLockBSV20(tick, max, lim, dec, hash)
        await hashLock.connect(getDefaultSigner())
        await hashLock.deployToken()
        deployTx = await hashLock.mint(100n)
    })

    it('should unlock successfully after instance recovery', async () => {
        // create instance from deploy tx
        const hashLock = HashLockBSV20.fromTx(deployTx, deployOutputIndex)
        await hashLock.connect(getDefaultSigner())

        const addr = Addr(myAddress.toByteString())
        const receiver = new BSV20P2PKH(tick, max, lim, dec, addr)
        const call = async () =>
            await hashLock.methods.unlock(message, {
                transfer: {
                    instance: receiver,
                    amt: 10n,
                },
            })
        await expect(call()).not.to.be.rejected
    })
})
