/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { sha256, toByteString } from 'scrypt-ts'
import { HashPuzzle } from '../contracts/hashPuzzle'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `HashPuzzle`', () => {
    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = max / 10n
    const amt = 1000n

    let hashPuzzle: HashPuzzle
    before(async () => {
        await HashPuzzle.loadArtifact()
        hashPuzzle = new HashPuzzle(
            tick,
            max,
            lim,
            sha256(toByteString('hello, sCrypt!:0', true))
        )
        await hashPuzzle.connect(getDefaultSigner())

        await hashPuzzle.deployToken()
        await hashPuzzle.mint(amt)
    })

    it('transfer to an other hashPuzzle and withdraw.', async () => {
        const callContract = async () => {
            for (let i = 0; i < 3; i++) {
                const { tx, tokenChangeP2PKH, receivers } =
                    await hashPuzzle.transfer(
                        [
                            {
                                instance: new HashPuzzle(
                                    tick,
                                    max,
                                    lim,
                                    sha256(
                                        toByteString(
                                            `hello, sCrypt!:${i + 1}`,
                                            true
                                        )
                                    )
                                ),
                                amt: 10n,
                            },
                        ],
                        'unlock',
                        toByteString(`hello, sCrypt!:${i}`, true)
                    )

                if (tokenChangeP2PKH) {
                    expect(tokenChangeP2PKH.getBSV20Amt()).to.be.equal(990n)
                }

                hashPuzzle = receivers[0] as HashPuzzle

                console.log('transfer tx: ', tx.id)
            }

            const withdraw = async () => {
                const address = await hashPuzzle.signer.getDefaultAddress()
                const { tx, tokenChangeP2PKH } = await hashPuzzle.transfer(
                    [
                        {
                            instance: OrdP2PKH.fromAddress(address),
                            amt: hashPuzzle.getAmt(),
                        },
                    ],
                    'unlock',
                    toByteString(`hello, sCrypt!:3`, true)
                )

                expect(tokenChangeP2PKH).to.be.null
                console.log('withdraw tx: ', tx.id)
            }
            await expect(withdraw()).not.rejected
        }

        await expect(callContract()).not.rejected
    })
})
