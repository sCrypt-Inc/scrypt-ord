import { expect, use } from 'chai'
import { PubKey, findSig, toByteString, toHex } from 'scrypt-ts'
import { PermissionedBSV21 } from '../contracts/permissionedBSV21'
import { getDefaultSigner, randomPrivateKey } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { myPublicKey, myPrivateKey } from '../utils/privateKey'
import { OrdiMethodCallOptions } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `PermissionedBSV21`', () => {
    const max = 1000n
    const sym = toByteString('MEME', true)
    const dec = 0n
    const amount = max
    const tokenTransferAmount = 10n
    const tokenChangeAmount = amount - tokenTransferAmount

    let instance: PermissionedBSV21

    const issuerPublicKey = myPublicKey
    const [alicePrivateKey, alicePublicKey, ,] = randomPrivateKey()
    const [bobPrivateKey, bobPublicKey, ,] = randomPrivateKey()

    before(async () => {
        PermissionedBSV21.loadArtifact()

        instance = new PermissionedBSV21(
            toByteString(''),
            sym,
            max,
            dec,
            PubKey(toHex(issuerPublicKey)),
            PubKey(toHex(alicePublicKey))
        )
        await instance.connect(
            getDefaultSigner([myPrivateKey, alicePrivateKey, bobPrivateKey])
        )

        await instance.deployToken()
    })

    it('should pass when calling `transfer`', async () => {
        const call = async () => {
            const { tx } = await instance.methods.transfer(
                PubKey(toHex(bobPublicKey)),
                tokenTransferAmount,
                tokenChangeAmount,
                (sigResps) => findSig(sigResps, alicePublicKey),
                (sigResps) => findSig(sigResps, issuerPublicKey),
                {
                    pubKeyOrAddrToSign: [alicePublicKey, issuerPublicKey],
                } as OrdiMethodCallOptions<PermissionedBSV21>
            )

            console.log('tranfer tx:', tx.id)
        }

        await expect(call()).not.to.be.rejected
    })
})
