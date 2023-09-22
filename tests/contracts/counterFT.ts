import {
    method,
    prop,
    assert,
    SigHash,
    hash256,
    ByteString,
    Addr,
} from 'scrypt-ts'

import { BSV20V1 } from '../scrypt-ord'

export class CounterFT extends BSV20V1 {
    @prop(true)
    counter: bigint

    constructor(tick: ByteString, max: bigint, lim: bigint, counter: bigint) {
        super(tick, max, lim)
        this.init(...arguments)
        this.counter = counter
    }

    @method(SigHash.ANYONECANPAY_ALL)
    public inc(address: Addr, changeTokenAmt: bigint) {
        this.incCounter()

        const outputs =
            this.buildStateOutputFT(changeTokenAmt) +
            BSV20V1.buildTransferOutput(address, this.tick, 100n) +
            this.buildChangeOutput()

        assert(
            this.ctx.hashOutputs == hash256(outputs),
            'hashOutputs check failed'
        )
    }

    @method()
    incCounter(): boolean {
        this.counter++
        return true
    }
}
