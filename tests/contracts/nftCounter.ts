import { method, prop, assert, SigHash, hash256 } from 'scrypt-ts'

import { OneSatNFT } from '../scrypt-ord'

export class NFTCounter extends OneSatNFT {
    @prop(true)
    counter: bigint

    constructor(counter: bigint) {
        super()
        this.init(counter)
        this.counter = counter
    }

    @method(SigHash.ANYONECANPAY_ALL)
    public incOnchain() {
        this.incCounter()

        const outputs = this.buildStateOutputNFT() + this.buildChangeOutput()

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
