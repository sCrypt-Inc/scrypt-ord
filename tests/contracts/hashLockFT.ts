import { method, prop, assert, ByteString, sha256, Sha256 } from 'scrypt-ts'

import { BSV20 } from '../scrypt-ord'

export class HashLockFT extends BSV20 {
    @prop()
    hash: Sha256

    constructor(
        tick: ByteString,
        max: bigint,
        lim: bigint,
        dec: bigint,
        hash: Sha256
    ) {
        super(tick, max, lim, dec)
        this.init(...arguments)
        this.hash = hash
    }

    @method()
    public unlock(message: ByteString) {
        assert(this.hash == sha256(message), 'hashes are not equal')
    }
}
