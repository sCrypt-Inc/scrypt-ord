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

export class FtCounter extends BSV20V1 {
    @prop(true)
    counter: bigint

    constructor(tick: ByteString, max: bigint, lim: bigint, counter: bigint) {
        super(tick, max, lim)
        this.setConstructor(...arguments)
        this.counter = counter
    }

    @method(SigHash.ANYONECANPAY_ALL)
    public inc(address: Addr, changeAmt: bigint) {
        this.incCounter()

        const outputs =
            this.build1SatStateOutput(changeAmt) +
            BSV20V1.buildTransferOutput(address, this.tick, 1n) +
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
