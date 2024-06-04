import { expect, use } from 'chai'
import { Addr, PubKey, findSig, toByteString } from 'scrypt-ts'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import {
    BSV21P2PKH,
    OrdiMethodCallOptions,
    fromByteString,
} from '../scrypt-ord'
import { dummyBSV20V2 } from './utils'
import { CounterFTV2 } from '../contracts/counterFTV2'
import { myAddress, myPublicKey } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test SmartContract send FT to `CounterFTV2`', () => {
    const tokenId = toByteString(
        '71b08aff9e5017b71bffc66e57e858bb6225084142e36ff60ee40d6cf6d25cf3_0',
        true
    )
    const max = 100000n
    const dec = 0n
    const sym = toByteString('MEME', true)

    const tokenInP2PKH = 1000n
    const tokenToCounter = 400n
    const tokenToP2PKH = 250n

    before(async () => {
        CounterFTV2.loadArtifact()
    })

    async function transferToCounter(
        p2pkh: BSV21P2PKH
    ): Promise<CounterFTV2> {
        const counter = new CounterFTV2(tokenId, sym, max, dec, 0n)
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
            } as OrdiMethodCallOptions<BSV21P2PKH>
        )
        console.log('transfer FT:', tx.id)

        // 2 outputs
        expect(nexts.length).to.equal(2)
        // output #0, token receiver, counter instance
        expect(counter.getAmt()).to.equal(transferAmount)
        // output #1, token change, ordP2PKH instance
        const tokenChange = nexts[1].instance as BSV21P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)

        return counter
    }

    async function counterTransfer(counter: CounterFTV2) {
        const totalAmount = tokenToCounter
        const counterAmount = 10n
        const p2pkhAmount = tokenToP2PKH
        const changeAmount = totalAmount - counterAmount - p2pkhAmount

        const nextInstance = counter.next()
        nextInstance.incCounter()

        const p2pkh = new BSV21P2PKH(
            tokenId,
            sym,
            max,
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
        } as OrdiMethodCallOptions<CounterFTV2>)
        console.log('transfer FT: ', tx.id)

        expect(nexts.length).to.equal(3)
        expect(nextInstance.getAmt()).to.equal(counterAmount)
        expect(p2pkh.getAmt()).to.eq(p2pkhAmount)

        const tokenChange = nexts[2].instance as BSV21P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)
    }

    it('P2PKH with inscription appended', async () => {
        const p2pkh = BSV21P2PKH.fromUTXO(
            dummyBSV20V2(myAddress, fromByteString(tokenId), tokenInP2PKH)
        )
        await p2pkh.connect(getDefaultSigner())

        const counter = await transferToCounter(p2pkh)
        await expect(counterTransfer(counter)).not.to.be.rejected
    })

    it('P2PKH with inscription prepended', async () => {
        const p2pkh = BSV21P2PKH.fromUTXO(
            dummyBSV20V2(myAddress, fromByteString(tokenId), tokenInP2PKH)
        )
        await p2pkh.connect(getDefaultSigner())

        const counter = await transferToCounter(p2pkh)
        await expect(counterTransfer(counter)).not.to.be.rejected
    })
})
