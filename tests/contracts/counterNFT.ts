import {
    method,
    prop,
    assert,
    hash256,
    Utils,
    bsv,
    ContractTransaction,
    int2ByteString,
    slice,
    ByteString,
} from 'scrypt-ts'

import { OrdiMethodCallOptions, OrdinalNFT } from '../scrypt-ord'

export class CounterNFT extends OrdinalNFT {
    @prop(true)
    counter: bigint

    constructor(counter: bigint) {
        super()
        this.init(counter)
        this.counter = counter
    }

    @method()
    public incOnchain() {
        this.incCounter()

        // ensure the public method is called from the first input.
        const outpoint =
            this.ctx.utxo.outpoint.txid +
            int2ByteString(this.ctx.utxo.outpoint.outputIndex, 4n)
        assert(
            slice(this.prevouts, 0n, 36n) == outpoint,
            'contract must be spent via first input'
        )

        const outputs = this.buildStateOutputNFT() + this.buildChangeOutput()
        assert(
            this.ctx.hashOutputs == hash256(outputs),
            'hashOutputs check failed'
        )
    }

    @method()
    public withdraw(script: ByteString) {
        this.incCounter()

        // ensure the public method is called from the first input.
        const outpoint =
            this.ctx.utxo.outpoint.txid +
            int2ByteString(this.ctx.utxo.outpoint.outputIndex, 4n)
        assert(
            slice(this.prevouts, 0n, 36n) == outpoint,
            'contract must be spent via first input'
        )

        const outputs =
            Utils.buildOutput(script, 1n) +
            this.buildStateOutputNFT() +
            this.buildChangeOutput()
        assert(
            this.ctx.hashOutputs == hash256(outputs),
            'hashOutputs check failed'
        )
    }

    @method()
    incCounter(): void {
        this.counter++
    }

    static async buildTxForWithdraw(
        current: CounterNFT,
        options: OrdiMethodCallOptions<CounterNFT>,
        outputScript: ByteString
    ): Promise<ContractTransaction> {
        const defaultAddress = await current.signer.getDefaultAddress()

        const nextInstance = current.next()
        nextInstance.incCounter()

        const tx = new bsv.Transaction()
            .addInput(current.buildContractInput())
            .addOutput(
                new bsv.Transaction.Output({
                    script: bsv.Script.fromHex(outputScript),
                    satoshis: 1,
                })
            )
            .addOutput(
                new bsv.Transaction.Output({
                    script: nextInstance.lockingScript,
                    satoshis: current.balance,
                })
            )
            .change(options.changeAddress || defaultAddress)

        return {
            tx,
            atInputIndex: 0,
            nexts: [
                {
                    instance: nextInstance,
                    balance: 1,
                    atOutputIndex: 1,
                },
            ],
        }
    }
}
