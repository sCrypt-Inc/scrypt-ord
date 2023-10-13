import { method, prop, assert, ByteString, sha256, Sha256 } from 'scrypt-ts'

import { OrdinalNFT } from '../scrypt-ord'

export class HashLockNFT extends OrdinalNFT {
    @prop()
    hash: Sha256

    constructor(hash: Sha256) {
        super()
        this.init(...arguments)
        this.hash = hash
    }

    @method()
    public unlock(message: ByteString) {
        assert(this.hash == sha256(message), 'hashes are not equal')
    }
}
