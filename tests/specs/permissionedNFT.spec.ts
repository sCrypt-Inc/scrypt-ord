import { expect, use } from 'chai'
import { PubKey, findSig } from 'scrypt-ts'
import { PermissionedNFT } from '../contracts/permissionedNFT'
import { getDefaultSigner, randomPrivateKey } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { myPublicKey, myPrivateKey } from '../utils/privateKey'
import { OrdiMethodCallOptions } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `PermissionedNFT`', () => {
    let instance: PermissionedNFT

    const issuerPublicKey = myPublicKey
    const [alicePrivateKey, alicePublicKey, ,] = randomPrivateKey()
    const [bobPrivateKey, bobPublicKey, ,] = randomPrivateKey()

    before(async () => {
        PermissionedNFT.loadArtifact()

        instance = new PermissionedNFT(
            PubKey(issuerPublicKey.toByteString()),
            PubKey(alicePublicKey.toByteString())
        )
        await instance.connect(
            getDefaultSigner([myPrivateKey, alicePrivateKey, bobPrivateKey])
        )

        await instance.inscribeText('hello world')
    })

    it('should pass when calling `transfer`', async () => {
        const nextInstance = instance.next()
        nextInstance.owner = PubKey(bobPublicKey.toByteString())

        const call = async () =>
            await instance.methods.transfer(
                PubKey(bobPublicKey.toByteString()),
                (sigResps) => findSig(sigResps, alicePublicKey),
                (sigResps) => findSig(sigResps, issuerPublicKey),
                {
                    transfer: nextInstance,
                    pubKeyOrAddrToSign: [alicePublicKey, issuerPublicKey],
                } as OrdiMethodCallOptions<PermissionedNFT>
            )

        await expect(call()).not.to.be.rejected
    })
})
