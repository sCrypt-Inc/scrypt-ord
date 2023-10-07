import { expect, use } from 'chai'
import {
    MethodCallOptions,
    PubKey,
    findSig,
    sha256,
    toByteString,
    Addr,
} from 'scrypt-ts'
import { HashPuzzleNFT } from '../contracts/hashPuzzleNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OrdNFTP2PKH } from '../scrypt-ord'
import { dummyNFT } from './utils'
import { myAddress, myPublicKey } from '../utils/privateKey'
import { CounterNFT } from '../contracts/counterNFT'
use(chaiAsPromised)

const chain = 'P2PKH -> HashPuzzle -> Counter -> Counter -> HashPuzzle -> P2PKH'

describe(`Chain NFT Test: ${chain}`, () => {
    before(async () => {
        HashPuzzleNFT.loadArtifact()
        CounterNFT.loadArtifact()
    })

    const text = 'Hello sCrypt!'
    const hash = sha256(toByteString(text, true))

    async function createP2PKH(): Promise<OrdNFTP2PKH> {
        const p2pkh = OrdNFTP2PKH.fromUTXO(dummyNFT(myAddress, text))
        await p2pkh.connect(getDefaultSigner())
        return p2pkh
    }

    async function toHashPuzzle(p2pkh: OrdNFTP2PKH): Promise<HashPuzzleNFT> {
        const hashPuzzle = new HashPuzzleNFT(hash)
        await hashPuzzle.connect(getDefaultSigner())
        const { tx } = await p2pkh.methods.unlock(
            (sigResps) => findSig(sigResps, myPublicKey),
            PubKey(myPublicKey.toByteString()),
            {
                transfer: hashPuzzle,
                pubKeyOrAddrToSign: myPublicKey,
            } as MethodCallOptions<OrdNFTP2PKH>
        )
        console.log('[1] P2PKH -> HashPuzzle:', tx.id)
        return hashPuzzle
    }

    async function toCounter(hashPuzzle: HashPuzzleNFT): Promise<CounterNFT> {
        const counter = new CounterNFT(0n)
        await counter.connect(getDefaultSigner())
        const { tx } = await hashPuzzle.methods.unlock(
            toByteString(text, true),
            {
                transfer: counter,
            } as MethodCallOptions<HashPuzzleNFT>
        )
        console.log('[2] HashPuzzle -> Counter:', tx.id)
        return counter
    }

    async function toCounterAgain(counter: CounterNFT): Promise<CounterNFT> {
        const nextInstance = counter.next()
        nextInstance.counter++
        const { tx } = await counter.methods.incOnchain({
            transfer: nextInstance,
        } as MethodCallOptions<CounterNFT>)
        console.log('[3] Counter -> Counter:', tx.id)
        return nextInstance
    }

    async function toHashPuzzleAgain(
        counter: CounterNFT
    ): Promise<HashPuzzleNFT> {
        const hashPuzzle = new HashPuzzleNFT(hash)
        await hashPuzzle.connect(getDefaultSigner())

        const script = toByteString(hashPuzzle.lockingScript.toHex())
        const { tx } = await counter.methods.withdraw(script)
        console.log('[4] Counter -> HashPuzzle:', tx.id)

        hashPuzzle.from = {
            tx,
            outputIndex: 0,
        }
        return hashPuzzle
    }

    async function toP2PKH(hashPuzzle: HashPuzzleNFT) {
        const p2pkh = new OrdNFTP2PKH(Addr(myAddress.toByteString()))
        await p2pkh.connect(getDefaultSigner())
        const { tx } = await hashPuzzle.methods.unlock(
            toByteString(text, true),
            {
                transfer: p2pkh,
            } as MethodCallOptions<HashPuzzleNFT>
        )
        console.log('[5] HashPuzzle -> P2PKH:', tx.id)
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
