import { expect, use } from 'chai'
import { bsv } from 'scrypt-ts'
import { CounterNFT } from '../contracts/counterNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test fromTx for SmartContract `CounterNFT`', () => {
    let deployTx: bsv.Transaction
    const deployOutputIndex = 0

    before(async () => {
        CounterNFT.loadArtifact()
        const counter = new CounterNFT(0n)
        await counter.connect(getDefaultSigner())
        deployTx = await counter.inscribeText('Hello World')
    })

    async function inc(
        tx: bsv.Transaction,
        atOutputIndex: number
    ): Promise<{ tx: bsv.Transaction; atOutputIndex: number }> {
        // create instance from tx
        const instance = CounterNFT.fromTx(tx, atOutputIndex)
        await instance.connect(getDefaultSigner())

        const nextInstance = instance.next()
        nextInstance.incCounter()

        const { tx: callTx, next } = await instance.methods.incOnchain({
            transfer: nextInstance,
        })
        return { tx: callTx, atOutputIndex: next!.atOutputIndex }
    }

    it('should unlock successfully after instance recovery', async () => {
        const call = async (loops: number = 3) => {
            let tx = deployTx
            let atOutputIndex = deployOutputIndex
            for (let i = 0; i < loops; ++i) {
                const r = await inc(tx, atOutputIndex)
                tx = r.tx
                atOutputIndex = r.atOutputIndex
            }
        }
        await expect(call()).not.to.be.rejected
    })
})
