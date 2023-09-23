/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { sha256, toByteString, MethodCallOptions } from 'scrypt-ts'
import { HashPuzzleFT } from '../contracts/hashPuzzleFT'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { BSV20P2PKH, FTReceiver } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `HashPuzzleFT`', () => {
    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = max / 10n
    const amt = 1000n

    let hashPuzzle: HashPuzzleFT
    before(async () => {
        HashPuzzleFT.loadArtifact()
        hashPuzzle = new HashPuzzleFT(
            tick,
            max,
            lim,
            sha256(toByteString('hello, sCrypt!:0', true))
        )
        await hashPuzzle.connect(getDefaultSigner())

        await hashPuzzle.deployToken()
        await hashPuzzle.mint(amt)
    })

    it('transfer to an other hashPuzzle.', async () => {
        const callContract = async () => {
            for (let i = 0; i < 3; i++) {
                const receiver = new HashPuzzleFT(
                    tick,
                    max,
                    lim,
                    sha256(toByteString(`hello, sCrypt!:${i + 1}`, true))
                )

                const recipients: Array<FTReceiver> = [
                    {
                        instance: receiver,
                        amt: 10n,
                    },
                ]

                const { tx } = await hashPuzzle.methods.unlock(
                    toByteString(`hello, sCrypt!:${i}`, true),
                    {
                        transfer: recipients,
                    }
                )

                hashPuzzle = recipients[0].instance as HashPuzzleFT
                await hashPuzzle.connect(getDefaultSigner())

                console.log('transfer tx: ', tx.id)
            }
        }

        await expect(callContract()).not.rejected
    })

    it('transfer to an other hashPuzzle with change.', async () => {
        const callContract = async () => {
            const receiver = new HashPuzzleFT(
                tick,
                max,
                lim,
                sha256(toByteString(`hello, sCrypt!`, true))
            )

            const recipients: Array<FTReceiver> = [
                {
                    instance: receiver,
                    amt: 9n,
                },
            ]

            const { tx, nexts } = await hashPuzzle.methods.unlock(
                toByteString(`hello, sCrypt!:3`, true),
                {
                    transfer: recipients,
                } as MethodCallOptions<HashPuzzleFT>
            )

            console.log('transfer tx: ', tx.id)

            expect(nexts.length === 2).to.be.true

            const p2pkh = nexts[1].instance as BSV20P2PKH

            expect(p2pkh.getAmt()).to.be.equal(1n)

            hashPuzzle = recipients[0].instance as HashPuzzleFT
            await hashPuzzle.connect(getDefaultSigner())
        }

        await expect(callContract()).not.rejected
    })

    it('transfer to an other hashPuzzle without change.', async () => {
        const callContract = async () => {
            const receiver = new HashPuzzleFT(
                tick,
                max,
                lim,
                sha256(toByteString(`hello, sCrypt!`, true))
            )

            const recipients: Array<FTReceiver> = [
                {
                    instance: receiver,
                    amt: 9n,
                },
            ]

            const { tx, nexts } = await hashPuzzle.methods.unlock(
                toByteString(`hello, sCrypt!`, true),
                {
                    transfer: recipients,
                    skipTokenChange: true,
                } as MethodCallOptions<HashPuzzleFT>
            )

            console.log('transfer tx: ', tx.id)

            expect(nexts.length === 1).to.be.true
        }

        await expect(callContract()).not.rejected
    })
})
