import { expect, use } from 'chai'
import { MethodCallOptions, bsv, toByteString } from 'scrypt-ts'
import { CounterFT } from '../contracts/counterFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { BSV20P2PKH } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test fromTx for SmartContract `CounterFT`', () => {
    const tick = toByteString('DOGE', true)
    const max = 100000n
    const lim = max / 10n

    let deployTx: bsv.Transaction

    before(async () => {
        CounterFT.loadArtifact()
        const counter = new CounterFT(tick, max, lim, 0n)
        await counter.connect(getDefaultSigner())
        await counter.deployToken()
        deployTx = await counter.mint(1000n)
    })

    async function inc(
        tx: bsv.Transaction,
        outputIndex: number
    ): Promise<{ tx: bsv.Transaction; atOutputIndex: number }> {
        // create instance from tx
        const instance = CounterFT.fromTxn(tx, outputIndex)
        await instance.connect(getDefaultSigner())

        const nextInstance = instance.next()
        nextInstance.counter++

        const changeAmount = 1n
        const transferAmount = instance.getAmt() - changeAmount

        const { tx: callTx, nexts } = await instance.methods.inc(
            transferAmount,
            {
                transfer: {
                    instance: nextInstance,
                    amt: transferAmount,
                },
            } as MethodCallOptions<CounterFT>
        )

        expect(nexts.length).to.equal(2)
        expect(nextInstance.getAmt()).to.equal(transferAmount)
        const tokenChange = nexts[1].instance as BSV20P2PKH
        expect(tokenChange.getAmt()).to.equal(changeAmount)

        return { tx: callTx, atOutputIndex: nexts[0]!.atOutputIndex }
    }

    it('should unlock successfully after instance recovery', async () => {
        const call = async (loops: number = 3) => {
            let tx = deployTx
            let outputIndex = 0
            for (let i = 0; i < loops; ++i) {
                const r = await inc(tx, outputIndex)
                tx = r.tx
                outputIndex = r.atOutputIndex
            }
        }
        await expect(call()).not.to.be.rejected
    })
})
