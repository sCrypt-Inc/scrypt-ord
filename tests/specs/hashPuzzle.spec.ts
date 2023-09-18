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
        await HashPuzzle.loadArtifact()
    })

    it('should pass the public method unit test successfully.', async () => {
        const hashPuzzle = new HashPuzzle(
            toByteString(tick, true),
            max,
            lim,
            sha256(message1)
        )
        await hashPuzzle.connect(getDefaultSigner())

        await hashPuzzle.deployToken()
        await hashPuzzle.mint(amt)

        const callContract = async () => {
            const { tx, nexts } = await hashPuzzle.transfer(
                [
                    {
                        instance: new HashPuzzle(
                            toByteString(tick, true),
                            max,
                            lim,
                            sha256(message2)
                        ),
                        amt: 10n,
                    },
                ],
                'unlock',
                message1
            )

            console.log('transfer tx: ', tx.id)

            const burn = async () => {
                const next0 = nexts[0].instance as HashPuzzle

                const { tx } = await next0.methods.unlock(message1)
                console.log('burn tx: ', tx.id)
            }
            await expect(burn()).not.rejected

            const burn1 = async () => {
                const next1 = nexts[1].instance as HashPuzzle
                try {
                    const { tx } = await next1.methods.unlock(message2)
                    console.log('burn tx: ', tx.id)
                } catch (error) {
                    console.log('aaa', error)
                }
            }
            await expect(burn1()).not.rejected
        }

        await expect(callContract()).not.rejected
    })
})
