/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { sha256, toByteString } from 'scrypt-ts'
import { HashPuzzle } from '../contracts/hashPuzzle'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `HashPuzzle`', () => {
    const tick = 'DOGE'
    const max = 100000n
    const lim = max / 10n
    const amt = 1000n

    const message1 = toByteString('hello, sCrypt!', true)
    const message2 = toByteString('hello, 1SAT!', true)

    let hashPuzzle: HashPuzzle
    before(async () => {
        await HashPuzzle.loadArtifact()
        hashPuzzle = new HashPuzzle(
            toByteString(tick, true),
            max,
            lim,
            sha256(message1)
        )
        await hashPuzzle.connect(getDefaultSigner())

        await hashPuzzle.deployToken()
        await hashPuzzle.mint(amt)
    })

    it('transfer to an other hashPuzzle and withdraw.', async () => {
        const callContract = async () => {
            const { tx, tokenChangeP2PKH, receivers } =
                await hashPuzzle.transfer(
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

            expect(tokenChangeP2PKH).not.be.null
            expect(tokenChangeP2PKH?.getBSV20Amt()).to.equal(990n)

            console.log('transfer tx: ', tx.id)

            const withdraw = async () => {
                const receiver = receivers[0]
                const address = await receiver.signer.getDefaultAddress()
                const { tx, tokenChangeP2PKH } = await receiver.transfer(
                    [
                        {
                            instance: OrdP2PKH.fromAddress(address),
                            amt: receiver.getAmt(),
                        },
                    ],
                    'unlock',
                    message2
                )

                expect(tokenChangeP2PKH).to.be.null
                console.log('withdraw tx: ', tx.id)
            }
            await expect(withdraw()).not.rejected
        }

        await expect(callContract()).not.rejected
    })
})
