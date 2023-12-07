import { expect, use } from 'chai'
import { sha256, toByteString } from 'scrypt-ts'
import { HashLockFT } from '../contracts/hashLockFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20V1P2PKH, FTReceiver, OrdiMethodCallOptions } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `HashLockFT`', () => {
    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = max / 10n
    const amt = 1000n
    const dec = 0n

    let hashLock: HashLockFT
    before(async () => {
        HashLockFT.loadArtifact()
        hashLock = new HashLockFT(
            tick,
            max,
            lim,
            dec,
            sha256(toByteString('hello, sCrypt!:0', true))
        )
        await hashLock.connect(getDefaultSigner())

        await hashLock.deployToken()
        await hashLock.mint(amt)
    })

    it('transfer to an other hashLock.', async () => {
        const callContract = async () => {
            for (let i = 0; i < 3; i++) {
                const receiver = new HashLockFT(
                    tick,
                    max,
                    lim,
                    dec,
                    sha256(toByteString(`hello, sCrypt!:${i + 1}`, true))
                )

                const recipients: Array<FTReceiver> = [
                    {
                        instance: receiver,
                        amt: 10n,
                    },
                ]

                const { tx } = await hashLock.methods.unlock(
                    toByteString(`hello, sCrypt!:${i}`, true),
                    {
                        transfer: recipients,
                    }
                )

                hashLock = recipients[0].instance as HashLockFT
                await hashLock.connect(getDefaultSigner())

                console.log('transfer tx: ', tx.id)
            }
        }

        await expect(callContract()).not.rejected
    })

    it('transfer to an other hashLock with change.', async () => {
        const callContract = async () => {
            const receiver = new HashLockFT(
                tick,
                max,
                lim,
                dec,
                sha256(toByteString(`hello, sCrypt!`, true))
            )

            const recipients: Array<FTReceiver> = [
                {
                    instance: receiver,
                    amt: 9n,
                },
            ]

            const { tx, nexts } = await hashLock.methods.unlock(
                toByteString(`hello, sCrypt!:3`, true),
                {
                    transfer: recipients,
                } as OrdiMethodCallOptions<HashLockFT>
            )

            console.log('transfer tx: ', tx.id)

            expect(nexts.length === 2).to.be.true

            const p2pkh = nexts[1].instance as BSV20V1P2PKH

            expect(p2pkh.getAmt()).to.be.equal(1n)

            hashLock = recipients[0].instance as HashLockFT
            await hashLock.connect(getDefaultSigner())
        }

        await expect(callContract()).not.rejected
    })

    it('transfer to an other hashLock without change.', async () => {
        const callContract = async () => {
            const receiver = new HashLockFT(
                tick,
                max,
                lim,
                dec,
                sha256(toByteString(`hello, sCrypt!`, true))
            )

            const recipients: Array<FTReceiver> = [
                {
                    instance: receiver,
                    amt: 9n,
                },
            ]

            const { tx, nexts } = await hashLock.methods.unlock(
                toByteString(`hello, sCrypt!`, true),
                {
                    transfer: recipients,
                    skipTokenChange: true,
                } as OrdiMethodCallOptions<HashLockFT>
            )

            console.log('transfer tx: ', tx.id)

            expect(nexts.length === 1).to.be.true
        }

        await expect(callContract()).not.rejected
    })

    it('transfer without receiver.', async () => {
        const callContract = async () => {
            const { tx, nexts } = await hashLock.methods.unlock(
                toByteString(`hello, sCrypt!`, true),
                {
                    skipTokenChange: false,
                } as OrdiMethodCallOptions<HashLockFT>
            )

            console.log('transfer tx: ', tx.id)

            expect(nexts.length === 1).to.be.true

            expect(nexts[0].instance instanceof BSV20V1P2PKH).to.be.true

            expect(nexts[0].instance.getAmt() === 9n).to.be.true
        }

        await expect(callContract()).not.rejected
    })

    it('should fail when passing incorrect message', async () => {
        const receiver = new HashLockFT(
            tick,
            max,
            lim,
            dec,
            sha256(toByteString('HashLock', true))
        )
        const call = async () =>
            await hashLock.methods.unlock(
                toByteString('incorrect message', true),
                {
                    transfer: {
                        instance: receiver,
                        amt: 9n,
                    },
                } as OrdiMethodCallOptions<HashLockFT>
            )
        await expect(call()).to.be.rejectedWith(/hashes are not equal/)
    })
})
