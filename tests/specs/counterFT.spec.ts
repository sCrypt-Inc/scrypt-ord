import { expect, use } from 'chai'
import { toByteString, bsv, Addr } from 'scrypt-ts'
import { CounterFT } from '../contracts/counterFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20P2PKH } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `CounterFT`', () => {
    let instance: CounterFT
    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = max / 10n
    const amt = lim

    before(async () => {
        CounterFT.loadArtifact()
        instance = new CounterFT(tick, max, lim, 0n)
        await instance.connect(getDefaultSigner())

        await instance.deployToken()
        await instance.mint(amt)
    })

    it('should pass the public method unit test successfully.', async () => {
        let currentInstance = instance
        const receiver = bsv.PrivateKey.fromRandom(
            bsv.Networks.testnet
        ).toAddress()

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
                        transfer: [
                            {
                                instance: nextInstance,
                                amt: tokenChangeAmt,
                            },
                            {
                                instance: new BSV20P2PKH(
                                    tick,
                                    max,
                                    lim,
                                    Addr(receiver.toByteString())
                                ),
                                amt: 100n,
                            },
                        ],
                    }
                )
                console.log('Contract CounterFT called: ', tx.id)
                expect(nexts.length).to.equal(2)
                expect(nextInstance.getAmt()).to.equal(transferAmount)
                const tokenChange = nexts[1].instance as OrdP2PKH
                expect(tokenChange.getBSV20Amt()).to.equal(changeAmount)
            }
            await expect(callContract()).not.to.be.rejected

            // update the current instance reference
            currentInstance = nextInstance
        }
    })
})
