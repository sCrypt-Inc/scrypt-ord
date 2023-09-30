import { expect, use } from 'chai'
import {
    Addr,
    MethodCallOptions,
    PubKey,
    findSig,
    toByteString,
} from 'scrypt-ts'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20V1P2PKH, fromByteString } from '../scrypt-ord'
import { dummyBSV20 } from './utils'
import { CounterFT } from '../contracts/counterFT'
import { myAddress, myPublicKey } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test SmartContract send FT to `CounterFT`', () => {
    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = max / 10n
    const dec = 0n

    const tokenInP2PKH = 1000n
    const tokenToCounter = 400n
    const tokenToP2PKH = 250n

    before(async () => {
        CounterFT.loadArtifact()
    })

    async function transferToCounter(p2pkh: BSV20V1P2PKH): Promise<CounterFT> {
        const counter = new CounterFT(tick, max, lim, dec, 0n)
        await counter.connect(getDefaultSigner())

        const totalAmount = tokenInP2PKH
        const transferAmount = tokenToCounter
        const changeAmount = totalAmount - transferAmount

        const { tx, nexts } = await p2pkh.methods.unlock(
            (sigResps) => findSig(sigResps, myPublicKey),
            PubKey(myPublicKey.toByteString()),
            {
                transfer: [
                    {
                        instance: counter,
                        amt: transferAmount,
                    },
                ],
                pubKeyOrAddrToSign: myPublicKey,
            } as MethodCallOptions<BSV20V1P2PKH>
        )
        console.log('transfer FT:', tx.id)

        // 2 outputs
        expect(nexts.length).to.equal(2)
        // output #0, token receiver, counter instance
        expect(counter.getAmt()).to.equal(transferAmount)
        // output #1, token change, ordP2PKH instance
        const tokenChange = nexts[1].instance as BSV20V1P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)

        return counter
    }

    async function counterTransfer(counter: CounterFT) {
        const totalAmount = tokenToCounter
        const counterAmount = 10n
        const p2pkhAmount = tokenToP2PKH
        const changeAmount = totalAmount - counterAmount - p2pkhAmount

        const nextInstance = counter.next()
        nextInstance.incCounter()

        const p2pkh = new BSV20V1P2PKH(
            tick,
            max,
            lim,
            dec,
            Addr(myAddress.toByteString())
        )

        const { tx, nexts } = await counter.methods.inc(counterAmount, {
            transfer: [
                {
                    instance: nextInstance,
                    amt: counterAmount,
                },
                {
                    instance: p2pkh,
                    amt: p2pkhAmount,
                },
            ],
        } as MethodCallOptions<CounterFT>)
        console.log('transfer FT: ', tx.id)

        expect(nexts.length).to.equal(3)
        expect(nextInstance.getAmt()).to.equal(counterAmount)
        expect(p2pkh.getAmt()).to.eq(p2pkhAmount)

        const tokenChange = nexts[2].instance as BSV20V1P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)
    }

    it('P2PKH with inscription appended', async () => {
        const p2pkh = BSV20V1P2PKH.fromUTXO(
            dummyBSV20(myAddress, fromByteString(tick), tokenInP2PKH)
        )
        await p2pkh.connect(getDefaultSigner())

        const counter = await transferToCounter(p2pkh)
        await expect(counterTransfer(counter)).not.to.be.rejected
    })

    it('P2PKH with inscription prepended', async () => {
        const p2pkh = BSV20V1P2PKH.fromUTXO(
            dummyBSV20(myAddress, fromByteString(tick), tokenInP2PKH)
        )
        await p2pkh.connect(getDefaultSigner())

        const counter = await transferToCounter(p2pkh)
        await expect(counterTransfer(counter)).not.to.be.rejected
    })
})
