import { expect, use } from 'chai'
import { MethodCallOptions } from 'scrypt-ts'
import { NFTCounter } from '../contracts/nftCounter'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `ScryptOrd`', () => {
    let instance: NFTCounter

    before(async () => {
        await NFTCounter.compile()
        instance = new NFTCounter(1n)
        await instance.connect(getDefaultSigner())

        await instance.mintTextNft('hello, world!')
    })

    it('should pass the public method unit test successfully.', async () => {
        let currentInstance = instance

        // call the method of current instance to apply the updates on chain
        for (let i = 0; i < 3; ++i) {
            // create the next instance from the current
            const nextInstance = currentInstance.next()

            // apply updates on the next instance off chain
            nextInstance.incCounter()

            // call the method of current instance to apply the updates on chain
            const callContract = async () => {
                const { tx: callTx } = await currentInstance.methods.incOnchain(
                    {
                        next: {
                            instance: nextInstance,
                            balance: 1,
                        },
                    } as MethodCallOptions<NFTCounter>
                )

                console.log('Contract OrdinalCounter called: ', callTx.id)
            }

            await expect(callContract()).not.rejected

            // update the current instance reference
            currentInstance = nextInstance
        }
    })
})
