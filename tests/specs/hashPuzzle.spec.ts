/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { sha256, toByteString } from 'scrypt-ts'
import { HashPuzzle } from '../contracts/hashPuzzle'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH, TokenReceiver } from '../scrypt-ord'
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
                const recipients: Array<TokenReceiver> = [
                    {
                        instance: new HashPuzzle(
                            tick,
                            max,
                            lim,
                            sha256(
                                toByteString(`hello, sCrypt!:${i + 1}`, true)
                            )
                        ),
                        amt: 10n,
                    },
                ]

                const { tx } = await hashPuzzle.methods.unlock(
                    toByteString(`hello, sCrypt!:${i}`, true),
                    {
                        transfer: recipients,
                    }
                )

                hashPuzzle = recipients[0].instance as HashPuzzle

                console.log('transfer tx: ', tx.id)
            }

            const withdraw = async () => {
                const address = await hashPuzzle.signer.getDefaultAddress()
                const recipients = [
                    {
                        instance: OrdP2PKH.fromAddress(address),
                        amt: hashPuzzle.getAmt(),
                    },
                ]

                const { tx } = await hashPuzzle.methods.unlock(
                    toByteString(`hello, sCrypt!:3`, true),
                    {
                        transfer: recipients,
                    }
                )

                console.log('withdraw tx: ', tx.id)
            }
            await expect(withdraw()).not.rejected
        }

        await expect(callContract()).not.rejected
    })
})
