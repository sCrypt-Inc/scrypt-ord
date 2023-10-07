import { expect, use } from 'chai'
import { toByteString, MethodCallOptions } from 'scrypt-ts'
import { CounterFTV2 } from '../contracts/counterFTV2'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20V2P2PKH } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `CounterFTV2`', () => {
    let instance: CounterFTV2

    let tokenId: string
    before(async () => {
        CounterFTV2.loadArtifact()

        const max = 100000n
        const dec = 0n
        instance = new CounterFTV2(toByteString(''), max, dec, 0n)
        await instance.connect(getDefaultSigner())
        tokenId = await instance.deployToken()
    })

    it('should pass the public method unit test successfully.', async () => {
        let currentInstance = instance

        // call the method of current instance to apply the updates on chain
        for (let i = 0; i < 3; ++i) {
            // create the next instance from the current
            const nextInstance = currentInstance.next()

            nextInstance.id = toByteString(tokenId, true)
            // apply updates on the next instance off chain
            nextInstance.incCounter()

            // call the method of current instance to apply the updates on chain
            const changeAmount = 10n
            const transferAmount = currentInstance.getAmt() - changeAmount
            const callContract = async () => {
                const { tx, nexts } = await currentInstance.methods.inc(
                    transferAmount,
                    {
                        transfer: {
                            instance: nextInstance,
                            amt: transferAmount,
                        },
                    } as MethodCallOptions<CounterFTV2>
                )
                console.log('Contract CounterFTV2 called: ', tx.id)
                expect(nexts.length).to.equal(2)
                expect(nextInstance.getAmt()).to.equal(transferAmount)
                const tokenChange = nexts[1].instance as BSV20V2P2PKH
                expect(tokenChange.getAmt()).to.equal(changeAmount)
            }
            await expect(callContract()).not.to.be.rejected

            // update the current instance reference
            currentInstance = nextInstance
        }
    })
})
