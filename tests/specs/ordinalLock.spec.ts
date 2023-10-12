import { expect, use } from 'chai'
import { Addr, toHex, PubKey } from 'scrypt-ts'
import { OrdinalLock } from '../contracts/ordinalLock'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { myAddress, myPublicKey } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test SmartContract `OrdinalLock`', () => {
    const seller = PubKey(toHex(myPublicKey))
    const receiver = Addr(myAddress.toByteString())

    let instance: OrdinalLock

    before(async () => {
        OrdinalLock.loadArtifact()
        instance = new OrdinalLock(seller, 10n)
        await instance.connect(getDefaultSigner())
        await instance.inscribeText('Hello')
    })

    it('should pass', async () => {
        const call = async () => await instance.methods.purchase(receiver)
        await expect(call()).not.to.be.rejected
    })
})
