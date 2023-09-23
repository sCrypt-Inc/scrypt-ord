import { method, prop, PubKey, Sig, assert, hash256 } from 'scrypt-ts'

import { OneSatNFT } from '../scrypt-ord'

export class PermissionedNFT extends OneSatNFT {
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

        this.owner = recipient

        const outputs = this.buildStateOutputNFT() + this.buildChangeOutput()
        assert(
            this.ctx.hashOutputs == hash256(outputs),
            'hashOutputs check failed'
        )
    }
}
