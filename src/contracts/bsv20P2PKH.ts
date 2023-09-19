import {
    assert,
    hash160,
    method,
    prop,
    PubKey,
    PubKeyHash,
    Sig,
    bsv,
    Addr,
    toHex,
    ByteString,
    toByteString,
} from 'scrypt-ts'
import { BSV20V1 } from './bsv20V1'
import { DEFAULT_FLAGS } from 'scryptlib'

export class BSV20P2PKH extends BSV20V1 {
    // Address of the recipient.
    @prop()
    readonly pubKeyHash: PubKeyHash

    constructor(
        tick: ByteString,
        max: bigint,
        lim: bigint,
        pubKeyHash: PubKeyHash
    ) {
        super(tick, max, lim)
        this.init(...arguments)
        this.pubKeyHash = pubKeyHash
    }

    @method()
    public unlock(sig: Sig, pubkey: PubKey) {
        // Check if the passed public key belongs to the specified address.
        assert(
            hash160(pubkey) == this.pubKeyHash,
            'public key hashes are not equal'
        )
        // Check signature validity.
        assert(this.checkSig(sig, pubkey), 'signature check failed')
    }

    get lockingScript() {
        const nopScript = this.getPrependNOPScript()

        if (!nopScript) {
            throw new Error('no amt found, call setAmt() to set amt!')
        }

        const s = new bsv.Script('')
        s.add(bsv.Opcode.OP_DUP)
            .add(bsv.Opcode.OP_HASH160)
            .add(bsv.Script.fromASM(this.pubKeyHash))
            .add(bsv.Opcode.OP_EQUALVERIFY)
            .add(bsv.Opcode.OP_CHECKSIG)
            .add(this.getPrependNOPScript())

        return s
    }

    checkSig(
        signature: Sig,
        publickey: PubKey,
        errorMsg = 'signature check failed'
    ): boolean {
        let fSuccess = false
        const bufSig = Buffer.from(signature, 'hex')
        const bufPubkey = Buffer.from(toByteString(publickey), 'hex')

        try {
            const sig = bsv.crypto.Signature.fromTxFormat(bufSig)
            const pubkey = bsv.PublicKey.fromBuffer(bufPubkey, false)

            const tx = this.to.tx
            const inputIndex = this.to.inputIndex || 0
            const inputSatoshis = this.to.tx.inputs[inputIndex].output.satoshis

            fSuccess = tx.verifySignature(
                sig,
                pubkey,
                inputIndex,
                this.lockingScript,
                bsv.crypto.BN.fromNumber(inputSatoshis),
                DEFAULT_FLAGS
            )
        } catch (e) {
            // invalid sig or pubkey
            fSuccess = false
        }

        if (!fSuccess && bufSig.length) {
            // because NULLFAIL rule, always throw if catch a wrong signature
            // https://github.com/bitcoin/bips/blob/master/bip-0146.mediawiki#nullfail
            throw new Error(errorMsg)
        }

        return fSuccess
    }

    static fromAddress(
        tick: ByteString,
        max: bigint,
        lim: bigint,
        address: string | bsv.Address | bsv.PublicKey
    ) {
        const s = bsv.Script.buildPublicKeyHashOut(address)
        return new BSV20P2PKH(tick, max, lim, Addr(toHex(s.chunks[2].buf)))
    }
}

BSV20P2PKH.loadArtifact({
    version: 9,
    compilerVersion: '1.19.0+commit.72eaeba',
    contract: 'BSV20P2PKH',
    md5: '0c046dfb1f1a91cf72b9a852537bdfe1',
    structs: [],
    library: [],
    alias: [],
    abi: [
        {
            type: 'function',
            name: 'unlock',
            index: 0,
            params: [
                {
                    name: 'sig',
                    type: 'Sig',
                },
                {
                    name: 'pubkey',
                    type: 'PubKey',
                },
            ],
        },
        {
            type: 'constructor',
            params: [
                {
                    name: 'tick',
                    type: 'bytes',
                },
                {
                    name: 'max',
                    type: 'int',
                },
                {
                    name: 'lim',
                    type: 'int',
                },
                {
                    name: 'pubKeyHash',
                    type: 'Ripemd160',
                },
            ],
        },
    ],
    stateProps: [],
    buildType: 'debug',
    file: '',
    hex: '00000000<tick><max><lim><pubKeyHash>615379577a75567a567a567a567a567a567a51587a75577a577a577a577a577a577a577a0079567a75557a557a557a557a557a75757575615579557976a9<BSV20P2PKH.unlock.pkh>88ac777777777777',
    sourceMapFile: '',
})
