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

    constructor(
        tick: ByteString,
        max: bigint,
        lim: bigint,
        amt: bigint,
        counter: bigint
    ) {
        super(tick, max, lim, amt)
        this.setConstructor(...arguments)
        this.counter = counter
    }

    @method(SigHash.ANYONECANPAY_ALL)
    public inc(address: Addr) {
        this.incCounter()

        this.amt -= 1n

        assert(this.amt >= 0)

        const outputs =
            this.build1SatStateOutput() +
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
