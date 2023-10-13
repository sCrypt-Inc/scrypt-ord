import { expect, use } from 'chai'
import { Addr, toHex, PubKey, findSig, MethodCallOptions } from 'scrypt-ts'
import { OrdinalLock } from '../contracts/ordinalLock'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { myAddress, myPublicKey } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test SmartContract `OrdinalLock`', () => {
    const sellerPublicKey = myPublicKey
    const sellerPubKey = PubKey(toHex(sellerPublicKey))
    const receiverAddr = Addr(myAddress.toByteString())

    let instance: OrdinalLock

    before(async () => {
        OrdinalLock.loadArtifact()
        instance = new OrdinalLock(sellerPubKey, 10n)
        await instance.connect(getDefaultSigner())
        await instance.inscribeText('Hello')
    })

    it('should pass when calling `purchase`', async () => {
        const call = async () => await instance.methods.purchase(receiverAddr)
        await expect(call()).not.to.be.rejected
    })

    it('should pass when calling `cancel`', async () => {
        const call = async () =>
            await instance.methods.cancel(
                (sigResps) => findSig(sigResps, sellerPublicKey),
                {
                    pubKeyOrAddrToSign: sellerPublicKey,
                } as MethodCallOptions<OrdinalLock>
            )
        await expect(call()).not.to.be.rejected
    })
})
