import { method, prop, assert, ByteString, sha256, Sha256 } from 'scrypt-ts'

import { BSV20V1 } from '../scrypt-ord'

export class HashPuzzleFT extends BSV20V1 {
    @prop()
    hash: Sha256

    constructor(tick: ByteString, max: bigint, lim: bigint, hash: Sha256) {
        super(tick, max, lim)
        this.init(...arguments)
        this.hash = hash
    }

    @method()
    public unlock(message: ByteString) {
        assert(this.hash == sha256(message), 'hashes are not equal')
    }
}
