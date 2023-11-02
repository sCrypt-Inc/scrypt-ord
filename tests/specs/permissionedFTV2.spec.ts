import { expect, use } from 'chai'
import { PubKey, findSig, toByteString, toHex } from 'scrypt-ts'
import { PermissionedFTV2 } from '../contracts/permissionedFTV2'
import { getDefaultSigner, randomPrivateKey } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { myPublicKey } from '../utils/privateKey'
import { OrdiMethodCallOptions } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `PermissionedFTV2`', () => {
    const max = 1000n
    const sym = toByteString('MEME', true)
    const dec = 0n
    const amount = max
    const tokenTransferAmount = 10n
    const tokenChangeAmount = amount - tokenTransferAmount

    let instance: PermissionedFTV2

    const issuerPublicKey = myPublicKey
    const [alicePrivateKey, alicePublicKey, ,] = randomPrivateKey()
    const [bobPrivateKey, bobPublicKey, ,] = randomPrivateKey()

    before(async () => {
        PermissionedFTV2.loadArtifact()

        instance = new PermissionedFTV2(
            toByteString(''),
            sym,
            max,
            dec,
            PubKey(toHex(issuerPublicKey)),
            PubKey(toHex(alicePublicKey))
        )
        await instance.connect(
            getDefaultSigner([alicePrivateKey, bobPrivateKey])
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
                } as OrdiMethodCallOptions<PermissionedFTV2>
            )

            console.log('tranfer tx:', tx.id)
        }

        await expect(call()).not.to.be.rejected
    })
})
