import { expect, use } from 'chai'
import {
    MethodCallOptions,
    PubKey,
    findSig,
    sha256,
    toByteString,
    fromByteString,
    Addr,
} from 'scrypt-ts'
import { HashLockFT } from '../contracts/hashLockFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20V1P2PKH } from '../scrypt-ord'
import { dummyBSV20 } from './utils'
import { myAddress, myPublicKey } from '../utils/privateKey'
import { CounterFT } from '../contracts/counterFT'
use(chaiAsPromised)

const chain = 'P2PKH -> HashLock -> Counter -> Counter -> HashLock -> P2PKH'

describe(`Chain FT Test: ${chain}`, () => {
    before(async () => {
        HashLockFT.loadArtifact()
        CounterFT.loadArtifact()
    })

    const text = 'Hello sCrypt!'
    const hash = sha256(toByteString(text, true))

    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = 10000n
    const dec = 0n

    const tokenInP2PKH = 1000n
    const tokenToHashLock = 800n
    const tokenToCounter = 700n
    const tokenToCounterAgain = 650n
    const tokenToHashLockAgain = 300n
    const tokenToP2PKH = 120n

    async function createP2PKH(): Promise<BSV20V1P2PKH> {
        const p2pkh = BSV20V1P2PKH.fromUTXO(
            dummyBSV20(myAddress, fromByteString(tick), tokenInP2PKH)
        )
        await p2pkh.connect(getDefaultSigner())
        return p2pkh
    }

    async function toHashLock(p2pkh: BSV20V1P2PKH): Promise<HashLockFT> {
        const totalAmount = tokenInP2PKH
        const transferAmount = tokenToHashLock
        const changeAmount = totalAmount - transferAmount

        const hashLock = new HashLockFT(tick, max, lim, dec, hash)
        await hashLock.connect(getDefaultSigner())

        const { tx, nexts } = await p2pkh.methods.unlock(
            (sigResps) => findSig(sigResps, myPublicKey),
            PubKey(myPublicKey.toByteString()),
            {
                transfer: {
                    instance: hashLock,
                    amt: transferAmount,
                },
                pubKeyOrAddrToSign: myPublicKey,
            } as MethodCallOptions<BSV20V1P2PKH>
        )
        console.log('[1] P2PKH -> HashLock:', tx.id)

        expect(nexts.length).to.equal(2)

        expect(hashLock.getAmt()).to.equal(transferAmount)

        const tokenChange = nexts[1].instance as BSV20V1P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)

        return hashLock
    }

    async function toCounter(hashLock: HashLockFT): Promise<CounterFT> {
        const totalAmount = tokenToHashLock
        const transferAmount = tokenToCounter
        const changeAmount = totalAmount - transferAmount

        const counter = new CounterFT(tick, max, lim, dec, 0n)
        await counter.connect(getDefaultSigner())

        const { tx, nexts } = await hashLock.methods.unlock(
            toByteString(text, true),
            {
                transfer: {
                    instance: counter,
                    amt: transferAmount,
                },
            } as MethodCallOptions<HashLockFT>
        )
        console.log('[2] HashLock -> Counter:', tx.id)

        expect(nexts.length).to.equal(2)

        expect(counter.getAmt()).to.equal(transferAmount)

        const tokenChange = nexts[1].instance as BSV20V1P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)

        return counter
    }

    async function toCounterAgain(counter: CounterFT): Promise<CounterFT> {
        const totalAmount = tokenToCounter
        const transferAmount = tokenToCounterAgain
        const changeAmount = totalAmount - transferAmount

        const nextInstance = counter.next()
        nextInstance.incCounter()

        const { tx, nexts } = await counter.methods.inc(transferAmount, {
            transfer: {
                instance: nextInstance,
                amt: transferAmount,
            },
        } as MethodCallOptions<CounterFT>)
        console.log('[3] Counter -> Counter:', tx.id)

        expect(nexts.length).to.equal(2)

        expect(nextInstance.getAmt()).to.equal(transferAmount)

        const tokenChange = nexts[1].instance as BSV20V1P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)

        return nextInstance
    }

    async function toHashLockAgain(counter: CounterFT): Promise<HashLockFT> {
        const totalAmount = tokenToCounterAgain
        const hashLockAmount = tokenToHashLockAgain
        const counterAmount = 100n
        const changeAmount = totalAmount - hashLockAmount - counterAmount

        const nextInstance = counter.next()
        nextInstance.incCounter()

        const hashLock = new HashLockFT(tick, max, lim, dec, hash)
        await hashLock.connect(getDefaultSigner())

        const { tx, nexts } = await counter.methods.inc(counterAmount, {
            transfer: [
                {
                    instance: nextInstance,
                    amt: counterAmount,
                },
                {
                    instance: hashLock,
                    amt: hashLockAmount,
                },
            ],
        } as MethodCallOptions<CounterFT>)
        console.log('[4] Counter -> HashLock:', tx.id)

        expect(nexts.length).to.equal(3)

        expect(nextInstance.getAmt()).to.equal(counterAmount)
        expect(hashLock.getAmt()).to.equal(hashLockAmount)

        const tokenChange = nexts[2].instance as BSV20V1P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)

        return hashLock
    }

    async function toP2PKH(hashLock: HashLockFT) {
        const p2pkh = new BSV20V1P2PKH(
            tick,
            max,
            lim,
            dec,
            Addr(myAddress.toByteString())
        )
        await p2pkh.connect(getDefaultSigner())

        const { tx, nexts } = await hashLock.methods.unlock(
            toByteString(text, true),
            {
                transfer: {
                    instance: p2pkh,
                    amt: tokenToP2PKH,
                },
                skipTokenChange: true,
            } as MethodCallOptions<HashLockFT>
        )
        console.log('[5] HashLock -> P2PKH:', tx.id)

        expect(nexts.length).to.equal(1)
        expect(p2pkh.getAmt()).to.equal(tokenToP2PKH)
    }

    it('should pass', async () => {
        const call = async () => {
            const p2pkh = await createP2PKH()
            const hashLock = await toHashLock(p2pkh)
            const counter = await toCounter(hashLock)
            const counterAgain = await toCounterAgain(counter)
            const hashLockAgain = await toHashLockAgain(counterAgain)
            await toP2PKH(hashLockAgain)
        }
        await expect(call()).not.to.be.rejected
    })
})
