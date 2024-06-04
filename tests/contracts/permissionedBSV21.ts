import {
    method,
    prop,
    PubKey,
    Sig,
    assert,
    hash256,
    ByteString,
    toByteString,
    ContractTransaction,
    bsv,
    toHex,
} from 'scrypt-ts'

import { BSV21, OrdiMethodCallOptions } from '../scrypt-ord'

export class PermissionedBSV21 extends BSV21 {
    @prop()
    readonly issuer: PubKey

    @prop(true)
    owner: PubKey

    constructor(
        id: ByteString,
        sym: ByteString,
        max: bigint,
        dec: bigint,
        issuer: PubKey,
        owner: PubKey
    ) {
        super(id, sym, max, dec)
        this.init(...arguments)
        this.issuer = issuer
        this.owner = owner
    }

    @method()
    public transfer(
        recipient: PubKey,
        tokenTransferAmount: bigint,
        tokenChangeAmount: bigint,
        ownerSig: Sig,
        issuerSig: Sig
    ) {
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

        assert(
            tokenTransferAmount > 0n,
            'tokenTransferAmount should be greater than 0'
        )
        assert(
            tokenChangeAmount >= 0n,
            'tokenChangeAmount should be greater than or equal to 0'
        )

        let tokenChangeOutput = toByteString('')
        if (tokenChangeAmount > 0n) {
            tokenChangeOutput = this.buildStateOutputFT(tokenChangeAmount)
        }

        this.owner = recipient
        const tokenTransferOutput = this.buildStateOutputFT(tokenTransferAmount)

        const outputs =
            tokenTransferOutput + tokenChangeOutput + this.buildChangeOutput()
        assert(
            this.ctx.hashOutputs == hash256(outputs),
            'hashOutputs check failed'
        )
    }

    static async buildTxForTransfer(
        current: PermissionedBSV21,
        options: OrdiMethodCallOptions<PermissionedBSV21>,
        recipient: PubKey,
        tokenTransferAmount: bigint,
        tokenChangeAmount: bigint
    ): Promise<ContractTransaction> {
        const defaultAddress = await current.signer.getDefaultAddress()

        const tokenTransferNext = current.next()
        tokenTransferNext.owner = PubKey(toHex(recipient))
        tokenTransferNext.id = toByteString(current.getTokenId(), true)
        tokenTransferNext.setAmt(tokenTransferAmount)

        const nexts = [
            { instance: tokenTransferNext, balance: 1, atOutputIndex: 0 },
        ]

        const tx = new bsv.Transaction()
            .addInput(current.buildContractInput())
            .addOutput(
                new bsv.Transaction.Output({
                    script: tokenTransferNext.lockingScript,
                    satoshis: 1,
                })
            )

        if (tokenChangeAmount > 0) {
            const tokenChangeNext = current.next()
            tokenChangeNext.id = toByteString(current.getTokenId(), true)
            tokenChangeNext.setAmt(tokenChangeAmount)

            tx.addOutput(
                new bsv.Transaction.Output({
                    script: tokenChangeNext.lockingScript,
                    satoshis: 1,
                })
            )
            nexts.push({
                instance: tokenChangeNext,
                balance: 1,
                atOutputIndex: 1,
            })
        }
        const feePerKb = await current.provider?.getFeePerKb()

        tx.feePerKb(feePerKb as number).change(
            options.changeAddress || defaultAddress
        )
        return { tx, atInputIndex: 0, nexts }
    }
}
