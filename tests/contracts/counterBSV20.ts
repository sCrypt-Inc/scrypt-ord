import { method, prop, assert, SigHash, hash256, ByteString } from 'scrypt-ts'
import { BSV20 } from '../scrypt-ord'

export class CounterBSV20 extends BSV20 {
    @prop(true)
    counter: bigint

    constructor(
        tick: ByteString,
        max: bigint,
        lim: bigint,
        dec: bigint,
        counter: bigint
    ) {
        super(tick, max, lim, dec)
        this.init(...arguments)
        this.counter = counter
    }

    @method(SigHash.ANYONECANPAY_SINGLE)
    public inc(tokenAmt: bigint) {
        this.incCounter()

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
