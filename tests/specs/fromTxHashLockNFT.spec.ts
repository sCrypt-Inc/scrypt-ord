import { expect, use } from 'chai'
import { sha256, toByteString, bsv, Addr } from 'scrypt-ts'
import { HashLockNFT } from '../contracts/hashLockNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OrdiNFTP2PKH } from '../scrypt-ord'
import { myAddress } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test fromTx for SmartContract `HashLockNFT`', () => {
    const message = toByteString('Hello sCrypt', true)

    let deployTx: bsv.Transaction
    const deployOutputIndex = 0

    before(async () => {
        HashLockNFT.loadArtifact()
        const hash = sha256(message)
        const hashLock = new HashLockNFT(hash)
        await hashLock.connect(getDefaultSigner())
        deployTx = await hashLock.inscribeText('Hello World')
    })

    it('should unlock successfully after instance recovery', async () => {
        // create instance from deploy tx
        const hashLock = HashLockNFT.fromTx(deployTx, deployOutputIndex)
        await hashLock.connect(getDefaultSigner())

        const addr = Addr(myAddress.toByteString())
        const receiver = new OrdiNFTP2PKH(addr)
        const call = async () =>
            await hashLock.methods.unlock(message, {
                transfer: receiver,
            })
        await expect(call()).not.to.be.rejected
    })
})
