import { expect, use } from 'chai'
import { Addr, toByteString } from 'scrypt-ts'
import { CounterNFT } from '../contracts/counterNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { myAddress } from '../utils/privateKey'
import { OrdiNFTP2PKH, OrdiMethodCallOptions } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `CounterNFT`', () => {
    let instance: CounterNFT

    before(async () => {
        CounterNFT.loadArtifact()
        instance = new CounterNFT(1n)
        await instance.connect(getDefaultSigner())

        await instance.inscribeText('hello, world!')
    })

    it('should pass when calling `incOnchain`', async () => {
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
                        transfer: nextInstance,
                    } as OrdiMethodCallOptions<CounterNFT>
                )

                console.log('Contract CounterNFT called: ', callTx.id)
            }

            await expect(callContract()).not.rejected

            // update the current instance reference
            currentInstance = nextInstance
        }
    })

    it('should pass when calling `withdraw`', async () => {
        const receiver = new OrdiNFTP2PKH(Addr(myAddress.toByteString()))
        const call = async () =>
            await instance.methods.withdraw(
                toByteString(receiver.lockingScript.toHex())
            )
        await expect(call()).not.to.be.rejected
    })
})
