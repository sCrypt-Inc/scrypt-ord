/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import {
    ContractTransaction,
    MethodCallOptions,
    toByteString,
    bsv,
} from 'scrypt-ts'
import { FtCounter } from '../contracts/ftCounter'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `ScryptOrd`', () => {
    let instance: FtCounter
    const tick = 'DOGE'
    const totalSupply = 100000n

    before(async () => {
        await FtCounter.compile()
        instance = new FtCounter(0n, toByteString(tick, true), totalSupply)
        await instance.connect(getDefaultSigner())
        await instance.mint(tick, totalSupply)
    })

    it('should pass the public method unit test successfully.', async () => {
        let currentInstance = instance

        const changeAddress = await instance.signer.getDefaultAddress()

        const receiver = bsv.PrivateKey.fromRandom(
            bsv.Networks.testnet
        ).toAddress()

        // call the method of current instance to apply the updates on chain
        for (let i = 0; i < 3; ++i) {
            // create the next instance from the current
            const nextInstance = currentInstance.next()

            // apply updates on the next instance off chain
            nextInstance.incCounter()
            nextInstance.currentBalance -= 1n
            nextInstance.setBalance(tick, nextInstance.currentBalance)
            currentInstance.bindTxBuilder(
                'inc',
                async (
                    current: FtCounter,
                    options: MethodCallOptions<FtCounter>
                ): Promise<ContractTransaction> => {
                    const tx = new bsv.Transaction()

                    tx.addInput(current.buildContractInput())
                        .addOutput(
                            new bsv.Transaction.Output({
                                script: nextInstance.lockingScript,
                                satoshis: 1,
                            })
                        )
                        .addOutput(
                            FtCounter.buildTransferOutputOffChain(
                                receiver,
                                tick,
                                1n
                            )
                        )
                        .change(changeAddress)

                    return Promise.resolve({
                        tx,
                        atInputIndex: 0,
                        nexts: [
                            {
                                instance: nextInstance,
                                balance: 1,
                                atOutputIndex: 0,
                            },
                        ],
                    })
                }
            )

            // call the method of current instance to apply the updates on chain
            const callContract = async () => {
                try {
                    const { tx: callTx } = await currentInstance.methods.inc(
                        receiver.toByteString()
                    )

                    console.log('Contract OrdinalCounter called: ', callTx.id)
                } catch (error) {
                    console.log('ee', error)
                }
            }

            await expect(callContract()).not.rejected

            // update the current instance reference
            currentInstance = nextInstance
        }
    })
})
