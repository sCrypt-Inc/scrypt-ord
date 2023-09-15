/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import {
    ContractTransaction,
    MethodCallOptions,
    sha256,
    toByteString,
    bsv,
} from 'scrypt-ts'
import { HashPuzzle } from '../contracts/hashPuzzle'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `HashPuzzle`', () => {
    const tick = 'DOGE'
    const max = 100000n
    const lim = 100000n
    const amt = 100000n

    const message1 = toByteString('hello, sCrypt!', true)
    const message2 = toByteString('hello, 1SAT!', true)

    before(async () => {
        await HashPuzzle.compile()
        await HashPuzzle.deploy(getDefaultSigner(), tick, max, lim)
    })

    it('should pass the public method unit test successfully.', async () => {
        const hashPuzzle = new HashPuzzle(
            toByteString(tick, true),
            max,
            lim,
            amt,
            sha256(message1)
        )
        await hashPuzzle.connect(getDefaultSigner())

        await hashPuzzle.mint(amt)

        const changeAddress = await hashPuzzle.signer.getDefaultAddress()
        const nextHashPuzzle = new HashPuzzle(
            toByteString(tick, true),
            max,
            lim,
            amt,
            sha256(message2)
        )
        await nextHashPuzzle.connect(getDefaultSigner())

        const callContract = async () => {
            // apply updates on the next instance off chain
            nextHashPuzzle.setAmt(nextHashPuzzle.amt)
            hashPuzzle.bindTxBuilder(
                'unlock',
                async (
                    current: HashPuzzle,
                    options: MethodCallOptions<HashPuzzle>
                ): Promise<ContractTransaction> => {
                    const tx = new bsv.Transaction()

                    tx.addInput(current.buildContractInput())
                        .addOutput(
                            new bsv.Transaction.Output({
                                script: nextHashPuzzle.lockingScript,
                                satoshis: 1,
                            })
                        )
                        .change(changeAddress)

                    return Promise.resolve({
                        tx,
                        atInputIndex: 0,
                        nexts: [
                            {
                                instance: nextHashPuzzle,
                                balance: 1,
                                atOutputIndex: 0,
                            },
                        ],
                    })
                }
            )
            const { tx } = await hashPuzzle.methods.unlock(message1)

            console.log('transfer tx: ', tx.id)
        }

        await expect(callContract()).not.rejected

        const burn = async () => {
            const { tx } = await nextHashPuzzle.methods.unlock(message2)
            console.log('burn tx: ', tx.id)
        }
        return expect(burn()).not.rejected
    })
})
