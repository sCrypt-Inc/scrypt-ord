import { method, prop, assert, ByteString, sha256, Sha256 } from 'scrypt-ts'

import { BSV21 } from '../scrypt-ord'

export class HashLockBSV21 extends BSV21 {
    @prop()
    hash: Sha256

    constructor(
        id: ByteString,
        sym: ByteString,
        max: bigint,
        dec: bigint,
        hash: Sha256
    ) {
        super(id, sym, max, dec)
        this.init(...arguments)
        this.hash = hash
    }

    @method()
    public unlock(message: ByteString) {
        assert(this.hash == sha256(message), 'hashes are not equal')
    }
}
