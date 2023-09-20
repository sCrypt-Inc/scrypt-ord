/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import {
    ContractTransaction,
    MethodCallOptions,
    toByteString,
    bsv,
    Addr,
} from 'scrypt-ts'
import { FtCounter } from '../contracts/ftCounter'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { Ordinal } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `FtCounter`', () => {
    let instance: FtCounter
    const tick = 'DOGE'
    const max = 100000n
    const lim = max / 10n
    const amt = lim

    before(async () => {
        await FtCounter.loadArtifact()
        instance = new FtCounter(toByteString(tick, true), max, lim, 0n)
        await instance.connect(getDefaultSigner())
        await instance.deployToken()
        await instance.mint(amt)
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

            const amt = currentInstance.getAmt()
            const tokenChangeAmt = amt - 100n
            nextInstance.incCounter()
            nextInstance.setAmt(tokenChangeAmt)
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
                            Ordinal.toOutput(
                                FtCounter.buildTransferOutput(
                                    Addr(receiver.toByteString()),
                                    toByteString(tick, true),
                                    100n
                                )
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
                const { tx: callTx } = await currentInstance.methods.inc(
                    receiver.toByteString(),
                    tokenChangeAmt
                )

                console.log('Contract FtCounter called: ', callTx.id)
            }

            await expect(callContract()).not.rejected

            // update the current instance reference
            currentInstance = nextInstance
        }
    })
})
