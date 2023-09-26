/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { sha256, toByteString, MethodCallOptions } from 'scrypt-ts'
import { HashPuzzleFTV2 } from '../contracts/hashPuzzleFTV2'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { BSV20V2P2PKH, FTReceiver } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `HashPuzzleFTV2`', () => {
    const max = 100000n
    const dec = 0n

    let hashPuzzle: HashPuzzleFTV2
    let tokenId: string
    before(async () => {
        HashPuzzleFTV2.loadArtifact()
        hashPuzzle = new HashPuzzleFTV2(
            toByteString(''),
            max,
            dec,
            sha256(toByteString('hello, sCrypt!:0', true))
        )
        await hashPuzzle.connect(getDefaultSigner())

        tokenId = await hashPuzzle.deployToken()
        console.log('token id: ', tokenId)
    })

    it('transfer to an other hashPuzzle.', async () => {
        const callContract = async () => {
            for (let i = 0; i < 3; i++) {
                const receiver = new HashPuzzleFTV2(
                    toByteString(tokenId, true),
                    max,
                    dec,
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

                hashPuzzle = recipients[0].instance as unknown as HashPuzzleFTV2
                await hashPuzzle.connect(getDefaultSigner())

                console.log('transfer tx: ', tx.id)
            }
        }

        await expect(callContract()).not.rejected
    })

    it('transfer to an other hashPuzzle with change.', async () => {
        const callContract = async () => {
            const receiver = new HashPuzzleFTV2(
                toByteString(tokenId, true),
                max,
                dec,
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
                } as MethodCallOptions<HashPuzzleFTV2>
            )

            console.log('transfer tx: ', tx.id)

            expect(nexts.length === 2).to.be.true

            const p2pkh = nexts[1].instance as BSV20V2P2PKH

            expect(p2pkh.getAmt()).to.be.equal(1n)

            hashPuzzle = recipients[0].instance as HashPuzzleFTV2
            await hashPuzzle.connect(getDefaultSigner())
        }

        await expect(callContract()).not.rejected
    })

    it('transfer to an other hashPuzzle without change.', async () => {
        const callContract = async () => {
            const receiver = new HashPuzzleFTV2(
                toByteString(tokenId, true),
                max,
                dec,
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
                } as MethodCallOptions<HashPuzzleFTV2>
            )

            console.log('transfer tx: ', tx.id)

            expect(nexts.length === 1).to.be.true
        }

        await expect(callContract()).not.rejected
    })

    it('should fail when passing incorrect message', async () => {
        const receiver = new HashPuzzleFTV2(
            toByteString(tokenId, true),
            max,
            dec,
            sha256(toByteString('HashPuzzle', true))
        )
        const call = async () =>
            await hashPuzzle.methods.unlock(
                toByteString('incorrect message', true),
                {
                    transfer: {
                        instance: receiver,
                        amt: 9n,
                    },
                } as MethodCallOptions<HashPuzzleFTV2>
            )
        await expect(call()).to.be.rejectedWith(/hashes are not equal/)
    })
})
