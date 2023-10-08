import { method, prop, assert, ByteString, sha256, Sha256 } from 'scrypt-ts'

import { BSV20V2 } from '../scrypt-ord'

export class HashPuzzleFTV2 extends BSV20V2 {
    @prop()
    hash: Sha256

    constructor(id: ByteString, max: bigint, dec: bigint, hash: Sha256) {
        super(id, max, dec)
        this.init(...arguments)
        this.hash = hash
    }

    @method()
    public unlock(message: ByteString) {
        assert(this.hash == sha256(message), 'hashes are not equal')
    }
}
