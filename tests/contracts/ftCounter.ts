import {
    method,
    prop,
    assert,
    SigHash,
    hash256,
    ByteString,
    Addr,
} from 'scrypt-ts'

import { OrdinalFT } from '../scrypt-ord'

export class FtCounter extends OrdinalFT {
    @prop(true)
    counter: bigint

    @prop()
    tick: ByteString

    @prop()
    totalSupply: bigint

    @prop(true)
    currentBalance: bigint

    constructor(counter: bigint, tick: ByteString, totalSupply: bigint) {
        super()
        this.setConstructor(...arguments)
        this.counter = counter
        this.tick = tick
        this.totalSupply = totalSupply
        this.currentBalance = totalSupply
    }

    @method(SigHash.ANYONECANPAY_ALL)
    public inc(address: Addr) {
        this.incCounter()

        this.currentBalance -= 1n

        assert(this.currentBalance >= 0)

        const outputs =
            this.buildFTStateOutput(this.tick, this.currentBalance) +
            OrdinalFT.buildTransferOutput(address, this.tick, 1n) +
            this.buildChangeOutput()

        this.debug.diffOutputs(outputs)
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
