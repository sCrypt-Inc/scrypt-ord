import { method, prop, assert, SigHash, hash256 } from 'scrypt-ts'

import { OrdinalNFT } from '../scrypt-ord'

export class NFTCounter extends OrdinalNFT {
    @prop(true)
    counter: bigint

    constructor(counter: bigint) {
        super()
        this.setConstructor(counter)
        this.counter = counter
    }

    @method(SigHash.ANYONECANPAY_ALL)
    public incOnchain() {
        this.incCounter()

        const outputs = this.buildNFTStateOutput() + this.buildChangeOutput()

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
