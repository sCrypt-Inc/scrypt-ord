import { expect, use } from 'chai'
import { Addr, MethodCallOptions, toByteString } from 'scrypt-ts'
import { BSV20Mint } from '../contracts/bsv20Mint'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'

use(chaiAsPromised)

describe('Test SmartContract `bsv20Mint`', () => {
    const max = 100000n
    const dec = 0n
    const lim = 10n
    const sym = toByteString('MEME', true)

    let instance: BSV20Mint
    let tokenId: string
    before(async () => {
        BSV20Mint.loadArtifact()
        instance = new BSV20Mint(toByteString(''), sym, max, dec, lim)
        await instance.connect(getDefaultSigner())

        tokenId = await instance.deployToken()
        console.log('token id: ', tokenId)
    })

    it('call mint', async () => {
        const callContract = async () => {
            instance.bindTxBuilder('mint', BSV20Mint.mintTxBuilder)

            const address = await instance.signer.getDefaultAddress()
            const { tx } = await instance.methods.mint(
                Addr(address!.toByteString()),
                instance.lim,
                {} as MethodCallOptions<BSV20Mint>
            )

            console.log('tx:', tx.id)
        }

        await expect(callContract()).not.rejected
    })
})
