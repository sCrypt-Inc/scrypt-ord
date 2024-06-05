import { expect, use } from 'chai'
import { PubKey, findSig, toByteString } from 'scrypt-ts'
import { PermissionedBSV20 } from '../contracts/permissionedBSV20'
import { getDefaultSigner, randomPrivateKey } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { myPublicKey, myPrivateKey } from '../utils/privateKey'
import { OrdiMethodCallOptions } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `PermissionedBSV20`', () => {
    const tick = 'DOGE'
    const max = 1000n
    const lim = max / 10n
    const dec = 0n
    const amount = lim // 100
    const tokenChangeAmount = amount / 10n // 10
    const tokenTransferAmount = amount - tokenChangeAmount // 90

    let instance: PermissionedBSV20

    const issuerPublicKey = myPublicKey
    const [alicePrivateKey, alicePublicKey, ,] = randomPrivateKey()
    const [bobPrivateKey, bobPublicKey, ,] = randomPrivateKey()

    before(async () => {
        PermissionedBSV20.loadArtifact()

        instance = new PermissionedBSV20(
            toByteString(tick, true),
            max,
            lim,
            dec,
            PubKey(issuerPublicKey.toByteString()),
            PubKey(alicePublicKey.toByteString())
        )
        await instance.connect(
            getDefaultSigner([myPrivateKey, alicePrivateKey, bobPrivateKey])
        )

        await instance.deployToken()
        await instance.mint(amount)
    })

    it('should pass when calling `transfer`', async () => {
        const call = async () =>
            await instance.methods.transfer(
                PubKey(bobPublicKey.toByteString()),
                tokenTransferAmount,
                tokenChangeAmount,
                (sigResps) => findSig(sigResps, alicePublicKey),
                (sigResps) => findSig(sigResps, issuerPublicKey),
                {
                    pubKeyOrAddrToSign: [alicePublicKey, issuerPublicKey],
                } as OrdiMethodCallOptions<PermissionedBSV20>
            )

        await expect(call()).not.to.be.rejected
    })
})
