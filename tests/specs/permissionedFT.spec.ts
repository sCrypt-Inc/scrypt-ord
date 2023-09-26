import { expect, use } from 'chai'
import {
    MethodCallOptions,
    PubKey,
    findSig,
    toByteString,
    toHex,
} from 'scrypt-ts'
import { PermissionedFT } from '../contracts/permissionedFT'
import { getDefaultSigner, randomPrivateKey } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { myPublicKey } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test SmartContract `PermissionedFT`', () => {
    const tick = 'DOGE'
    const max = 1000n
    const lim = max / 10n
    const amount = lim // 100
    const tokenChangeAmount = amount / 10n // 10
    const tokenTransferAmount = amount - tokenChangeAmount // 90

    let instance: PermissionedFT

    const issuerPublicKey = myPublicKey
    const [alicePrivateKey, alicePublicKey, ,] = randomPrivateKey()
    const [bobPrivateKey, bobPublicKey, ,] = randomPrivateKey()

    before(async () => {
        PermissionedFT.loadArtifact()

        instance = new PermissionedFT(
            toByteString(tick, true),
            max,
            lim,
            PubKey(issuerPublicKey.toByteString()),
            PubKey(alicePublicKey.toByteString())
        )
        await instance.connect(
            getDefaultSigner([alicePrivateKey, bobPrivateKey])
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
                } as MethodCallOptions<PermissionedFT>
            )

        await expect(call()).not.to.be.rejected
    })
})
