/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { toByteString, bsv, Addr } from 'scrypt-ts'
import { CounterFT } from '../contracts/counterFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `CounterFT`', () => {
    let instance: CounterFT
    const tick = 'DOGE'
    const max = 100000n
    const lim = max / 10n
    const amt = lim

    before(async () => {
        CounterFT.loadArtifact()
        instance = new CounterFT(toByteString(tick, true), max, lim, 0n)
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

            const amt = currentInstance.getAmt()
            const tokenChangeAmt = amt - CounterFT.AMOUNT
            nextInstance.incCounter()

            // call the method of current instance to apply the updates on chain
            const callContract = async () => {
                const { tx: callTx } = await currentInstance.methods.inc(
                    receiver.toByteString(),
                    tokenChangeAmt,
                    {
                        transfer: [
                            {
                                instance: nextInstance,
                                amt: tokenChangeAmt,
                            },
                            {
                                instance: new OrdP2PKH(
                                    Addr(receiver.toByteString())
                                ),
                                amt: CounterFT.AMOUNT,
                            },
                        ],
                    }
                )

                console.log('Contract CounterFT called: ', callTx.id)
            }

            await expect(callContract()).not.rejected

            // update the current instance reference
            currentInstance = nextInstance
        }
    })
})
