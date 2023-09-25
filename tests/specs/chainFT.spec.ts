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
import { HashPuzzleFT } from '../contracts/hashPuzzleFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20P2PKH } from '../scrypt-ord'
import { dummyBSV20 } from './utils'
import { myAddress, myPublicKey } from '../utils/privateKey'
import { CounterFT } from '../contracts/counterFT'
use(chaiAsPromised)

const chain = 'P2PKH -> HashPuzzle -> Counter -> Counter -> HashPuzzle -> P2PKH'

describe(`Chain FT Test: ${chain}`, () => {
    before(async () => {
        HashPuzzleFT.loadArtifact()
        CounterFT.loadArtifact()
    })

    const text = 'Hello sCrypt!'
    const hash = sha256(toByteString(text, true))

    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = 10000n

    const tokenInP2PKH = 1000n
    const tokenToHashPuzzle = 800n
    const tokenToCounter = 700n
    const tokenToCounterAgain = 650n
    const tokenToHashPuzzleAgain = 300n
    const tokenToP2PKH = 120n

    async function createP2PKH(): Promise<BSV20P2PKH> {
        const p2pkh = BSV20P2PKH.fromUTXO(
            dummyBSV20(myAddress, fromByteString(tick), tokenInP2PKH)
        )
        await p2pkh.connect(getDefaultSigner())
        return p2pkh
    }

    async function toHashPuzzle(p2pkh: BSV20P2PKH): Promise<HashPuzzleFT> {
        const totalAmount = tokenInP2PKH
        const transferAmount = tokenToHashPuzzle
        const changeAmount = totalAmount - transferAmount

        const hashPuzzle = new HashPuzzleFT(tick, max, lim, hash)
        await hashPuzzle.connect(getDefaultSigner())

        const { tx, nexts } = await p2pkh.methods.unlock(
            (sigResps) => findSig(sigResps, myPublicKey),
            PubKey(myPublicKey.toByteString()),
            {
                transfer: {
                    instance: hashPuzzle,
                    amt: transferAmount,
                },
                pubKeyOrAddrToSign: myPublicKey,
            } as MethodCallOptions<BSV20P2PKH>
        )
        console.log('[1] P2PKH -> HashPuzzle:', tx.id)

        expect(nexts.length).to.equal(2)

        expect(hashPuzzle.getAmt()).to.equal(transferAmount)

        const tokenChange = nexts[1].instance as BSV20P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)

        return hashPuzzle
    }

    async function toCounter(hashPuzzle: HashPuzzleFT): Promise<CounterFT> {
        const totalAmount = tokenToHashPuzzle
        const transferAmount = tokenToCounter
        const changeAmount = totalAmount - transferAmount

        const counter = new CounterFT(tick, max, lim, 0n)
        await counter.connect(getDefaultSigner())

        const { tx, nexts } = await hashPuzzle.methods.unlock(
            toByteString(text, true),
            {
                transfer: {
                    instance: counter,
                    amt: transferAmount,
                },
            } as MethodCallOptions<HashPuzzleFT>
        )
        console.log('[2] HashPuzzle -> Counter:', tx.id)

        expect(nexts.length).to.equal(2)

        expect(counter.getAmt()).to.equal(transferAmount)

        const tokenChange = nexts[1].instance as BSV20P2PKH
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

        const tokenChange = nexts[1].instance as BSV20P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)

        return nextInstance
    }

    async function toHashPuzzleAgain(
        counter: CounterFT
    ): Promise<HashPuzzleFT> {
        const totalAmount = tokenToCounterAgain
        const hashPuzzleAmount = tokenToHashPuzzleAgain
        const counterAmount = 100n
        const changeAmount = totalAmount - hashPuzzleAmount - counterAmount

        const nextInstance = counter.next()
        nextInstance.incCounter()

        const hashPuzzle = new HashPuzzleFT(tick, max, lim, hash)
        await hashPuzzle.connect(getDefaultSigner())

        const { tx, nexts } = await counter.methods.inc(counterAmount, {
            transfer: [
                {
                    instance: nextInstance,
                    amt: counterAmount,
                },
                {
                    instance: hashPuzzle,
                    amt: hashPuzzleAmount,
                },
            ],
        } as MethodCallOptions<CounterFT>)
        console.log('[4] Counter -> HashPuzzle:', tx.id)

        expect(nexts.length).to.equal(3)

        expect(nextInstance.getAmt()).to.equal(counterAmount)
        expect(hashPuzzle.getAmt()).to.equal(hashPuzzleAmount)

        const tokenChange = nexts[2].instance as BSV20P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)

        return hashPuzzle
    }

    async function toP2PKH(hashPuzzle: HashPuzzleFT) {
        const p2pkh = new BSV20P2PKH(
            tick,
            max,
            lim,
            Addr(myAddress.toByteString())
        )
        await p2pkh.connect(getDefaultSigner())

        const { tx, nexts } = await hashPuzzle.methods.unlock(
            toByteString(text, true),
            {
                transfer: {
                    instance: p2pkh,
                    amt: tokenToP2PKH,
                },
                skipTokenChange: true,
            } as MethodCallOptions<HashPuzzleFT>
        )
        console.log('[5] HashPuzzle -> P2PKH:', tx.id)

        expect(nexts.length).to.equal(1)
        expect(p2pkh.getAmt()).to.equal(tokenToP2PKH)
    }

    it('should pass', async () => {
        const call = async () => {
            const p2pkh = await createP2PKH()
            const hashPuzzle = await toHashPuzzle(p2pkh)
            const counter = await toCounter(hashPuzzle)
            const counterAgain = await toCounterAgain(counter)
            const hashPuzzleAgain = await toHashPuzzleAgain(counterAgain)
            await toP2PKH(hashPuzzleAgain)
        }
        await expect(call()).not.to.be.rejected
    })
})
