/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { sha256, toByteString } from 'scrypt-ts'
import { HashPuzzle } from '../contracts/hashPuzzle'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import {
    BSV20V1,
    OrdMethodCallOptions,
    OrdP2PKH,
    TokenReceiver,
} from '../scrypt-ord'
use(chaiAsPromised)

describe('Test skipTokenChange', () => {
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
            sha256(toByteString('hello, sCrypt!', true))
        )
        await hashPuzzle.connect(getDefaultSigner())

        await hashPuzzle.deployToken()
        await hashPuzzle.mint(amt)
    })

    it('transfer to an other hashPuzzle with change.', async () => {
        const callContract = async () => {
            const recipients: Array<TokenReceiver> = [
                {
                    instance: new HashPuzzle(
                        tick,
                        max,
                        lim,
                        sha256(toByteString(`hello, sCrypt!`, true))
                    ),
                    amt: 10n,
                },
            ]

            const { tx, nexts } = await hashPuzzle.methods.unlock(
                toByteString(`hello, sCrypt!`, true),
                {
                    transfer: recipients,
                } as OrdMethodCallOptions<HashPuzzle>
            )

            console.log('transfer tx: ', tx.id)

            expect(nexts.length === 2).to.be.true

            const p2pkh = nexts[1].instance as OrdP2PKH

            expect(p2pkh.getBSV20Amt()).to.be.equal(990n)
        }

        await expect(callContract()).not.rejected
    })

    it('transfer to an other hashPuzzle without change.', async () => {
        const callContract = async () => {
            const recipients: Array<TokenReceiver> = [
                {
                    instance: new HashPuzzle(
                        tick,
                        max,
                        lim,
                        sha256(toByteString(`hello, sCrypt!`, true))
                    ),
                    amt: 10n,
                },
            ]

            const { tx, nexts } = await hashPuzzle.methods.unlock(
                toByteString(`hello, sCrypt!`, true),
                {
                    transfer: recipients,
                    skipTokenChange: true,
                } as OrdMethodCallOptions<HashPuzzle>
            )

            console.log('transfer tx: ', tx.id)

            expect(nexts.length === 1).to.be.true
        }

        await expect(callContract()).not.rejected
    })
})
