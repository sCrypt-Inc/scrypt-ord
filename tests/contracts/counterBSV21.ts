import { method, prop, assert, SigHash, hash256, ByteString } from 'scrypt-ts'
import { BSV21 } from '../scrypt-ord'

export class CounterBSV21 extends BSV21 {
    @prop(true)
    counter: bigint

    constructor(
        id: ByteString,
        sym: ByteString,
        max: bigint,
        dec: bigint,
        counter: bigint
    ) {
        super(id, sym, max, dec)
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
