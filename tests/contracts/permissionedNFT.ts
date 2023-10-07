import {
    method,
    prop,
    PubKey,
    Sig,
    assert,
    hash256,
    int2ByteString,
    slice,
} from 'scrypt-ts'

import { OrdinalNFT } from '../scrypt-ord'

export class PermissionedNFT extends OrdinalNFT {
    @prop()
    readonly issuer: PubKey

    @prop(true)
    owner: PubKey

    constructor(issuer: PubKey, owner: PubKey) {
        super()
        this.init(...arguments)
        this.issuer = issuer
        this.owner = owner
    }

    @method()
    public transfer(recipient: PubKey, ownerSig: Sig, issuerSig: Sig) {
        // check owner signature
        assert(
            this.checkSig(ownerSig, this.owner),
            'owner signature check failed'
        )
        // check issuer co-sign
        assert(
            this.checkSig(issuerSig, this.issuer),
            'issuer signature check failed'
        )

        // ensure the public method is called from the first input.
        const outpoint =
            this.ctx.utxo.outpoint.txid +
            int2ByteString(this.ctx.utxo.outpoint.outputIndex, 4n)
        assert(
            slice(this.prevouts, 0n, 36n) == outpoint,
            'contract must be spent via first input'
        )

        this.owner = recipient

        const outputs = this.buildStateOutputNFT() + this.buildChangeOutput()
        assert(
            this.ctx.hashOutputs == hash256(outputs),
            'hashOutputs check failed'
        )
    }
}
