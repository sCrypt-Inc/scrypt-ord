import { expect, use } from 'chai'
import { toByteString } from 'scrypt-ts'
import { CounterBSV20 } from '../contracts/counterBSV20'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20P2PKH, OrdiMethodCallOptions } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `CounterBSV20`', () => {
    let instance: CounterBSV20

    before(async () => {
        CounterBSV20.loadArtifact()

        const tick = 'DOGE'
        const max = 100000n
        const lim = max / 10n
        const amt = lim
        const dec = 0n
        instance = new CounterBSV20(toByteString(tick, true), max, lim, dec, 0n)
        await instance.connect(getDefaultSigner())

        await instance.deployToken()
        await instance.mint(amt)
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
                    } as OrdiMethodCallOptions<CounterBSV20>
                )
                console.log('Contract CounterFT called: ', tx.id)
                expect(nexts.length).to.equal(2)
                expect(nextInstance.getAmt()).to.equal(transferAmount)
                const tokenChange = nexts[1].instance as BSV20P2PKH
                expect(tokenChange.getAmt()).to.equal(changeAmount)
            }
            await expect(callContract()).not.to.be.rejected

            // update the current instance reference
            currentInstance = nextInstance
        }
    })
})