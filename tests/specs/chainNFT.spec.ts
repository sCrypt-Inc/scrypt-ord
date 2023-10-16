import { expect, use } from 'chai'
import { PubKey, findSig, sha256, toByteString, Addr } from 'scrypt-ts'
import { HashLockNFT } from '../contracts/hashLockNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OrdiNFTP2PKH, OrdiMethodCallOptions } from '../scrypt-ord'
import { dummyNFT } from './utils'
import { myAddress, myPublicKey } from '../utils/privateKey'
import { CounterNFT } from '../contracts/counterNFT'
use(chaiAsPromised)

const chain = 'P2PKH -> HashLock -> Counter -> Counter -> HashLock -> P2PKH'

describe(`Chain NFT Test: ${chain}`, () => {
    before(async () => {
        HashLockNFT.loadArtifact()
        CounterNFT.loadArtifact()
    })

    const text = 'Hello sCrypt!'
    const hash = sha256(toByteString(text, true))

    async function createP2PKH(): Promise<OrdiNFTP2PKH> {
        const p2pkh = OrdiNFTP2PKH.fromUTXO(dummyNFT(myAddress, text))
        await p2pkh.connect(getDefaultSigner())
        return p2pkh
    }

    async function toHashLock(p2pkh: OrdiNFTP2PKH): Promise<HashLockNFT> {
        const hashLock = new HashLockNFT(hash)
        await hashLock.connect(getDefaultSigner())
        const { tx } = await p2pkh.methods.unlock(
            (sigResps) => findSig(sigResps, myPublicKey),
            PubKey(myPublicKey.toByteString()),
            {
                transfer: hashLock,
                pubKeyOrAddrToSign: myPublicKey,
            } as OrdiMethodCallOptions<OrdiNFTP2PKH>
        )
        console.log('[1] P2PKH -> HashLock:', tx.id)
        return hashLock
    }

    async function toCounter(hashLock: HashLockNFT): Promise<CounterNFT> {
        const counter = new CounterNFT(0n)
        await counter.connect(getDefaultSigner())
        const { tx } = await hashLock.methods.unlock(toByteString(text, true), {
            transfer: counter,
        } as OrdiMethodCallOptions<HashLockNFT>)
        console.log('[2] HashLock -> Counter:', tx.id)
        return counter
    }

    async function toCounterAgain(counter: CounterNFT): Promise<CounterNFT> {
        const nextInstance = counter.next()
        nextInstance.counter++
        const { tx } = await counter.methods.incOnchain({
            transfer: nextInstance,
        } as OrdiMethodCallOptions<CounterNFT>)
        console.log('[3] Counter -> Counter:', tx.id)
        return nextInstance
    }

    async function toHashLockAgain(counter: CounterNFT): Promise<HashLockNFT> {
        const hashLock = new HashLockNFT(hash)
        await hashLock.connect(getDefaultSigner())

        const script = toByteString(hashLock.lockingScript.toHex())
        const { tx } = await counter.methods.withdraw(script)
        console.log('[4] Counter -> HashLock:', tx.id)

        hashLock.from = {
            tx,
            outputIndex: 0,
        }
        return hashLock
    }

    async function toP2PKH(hashLock: HashLockNFT) {
        const p2pkh = new OrdiNFTP2PKH(Addr(myAddress.toByteString()))
        await p2pkh.connect(getDefaultSigner())
        const { tx } = await hashLock.methods.unlock(toByteString(text, true), {
            transfer: p2pkh,
        } as OrdiMethodCallOptions<HashLockNFT>)
        console.log('[5] HashLock -> P2PKH:', tx.id)
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
