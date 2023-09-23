import { expect, use } from 'chai'
import { MethodCallOptions, PubKey, findSig, toHex } from 'scrypt-ts'
import { PermissionedNFT } from '../contracts/permissionedNFT'
import { getDefaultSigner, randomPrivateKey } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { myPublicKey } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test SmartContract `PermissionedNFT`', () => {
    let instance: PermissionedNFT

    const issuerPublicKey = myPublicKey
    const [alicePrivateKey, alicePublicKey, ,] = randomPrivateKey()
    const [bobPrivateKey, bobPublicKey, ,] = randomPrivateKey()

    before(async () => {
        PermissionedNFT.loadArtifact()

        instance = new PermissionedNFT(
            PubKey(toHex(issuerPublicKey)),
            PubKey(toHex(alicePublicKey))
        )
        await instance.connect(
            getDefaultSigner([alicePrivateKey, bobPrivateKey])
        )

        await instance.mintTextNft('hello world')
    })

    it('should pass when calling `transfer`', async () => {
        const nextInstance = instance.next()
        nextInstance.owner = PubKey(toHex(bobPublicKey))

        const call = async () =>
            await instance.methods.transfer(
                PubKey(toHex(bobPublicKey)),
                (sigResps) => findSig(sigResps, alicePublicKey),
                (sigResps) => findSig(sigResps, issuerPublicKey),
                {
                    transfer: nextInstance,
                    pubKeyOrAddrToSign: [alicePublicKey, issuerPublicKey],
                } as MethodCallOptions<PermissionedNFT>
            )

        await expect(call()).not.to.be.rejected
    })
})
