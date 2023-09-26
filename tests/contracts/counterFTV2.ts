import { method, prop, assert, SigHash, hash256, ByteString } from 'scrypt-ts'
import { BSV20V2 } from '../scrypt-ord'

export class CounterFTV2 extends BSV20V2 {
    @prop(true)
    counter: bigint

    constructor(id: ByteString, max: bigint, dec: bigint, counter: bigint) {
        super(id, max, dec)
        this.init(...arguments)
        this.counter = counter
    }

    @method(SigHash.ANYONECANPAY_SINGLE)
    public inc(tokenAmt: bigint) {
        this.incCounter()

        if (this.isGenesis()) {
            this.id = CounterFTV2.getId(
                this.ctx.utxo.outpoint.txid,
                this.ctx.utxo.outpoint.outputIndex
            )
        }

        const outputs = this.buildStateOutputFT(tokenAmt)

        assert(
            this.ctx.hashOutputs == hash256(outputs),
            'hashOutputs check failed'
        )
    }

    @method()
    incCounter(): void {
        this.counter++
    }
}
