/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    assert,
    method,
    prop,
    PubKey,
    Sig,
    bsv,
    Addr,
    SmartContract,
    UTXO,
    pubKey2Addr,
    Ripemd160,
} from 'scrypt-ts'

import { Ordinal } from './ordinal'
import { OneSatApis } from '../1satApis'
import { BSV20V1 } from './bsv20V1'
import { OneSatNFT } from './oneSatNFT'

const P2PKHScriptLen = 50

export class OneSatNFTP2PKH extends OneSatNFT {
    // Address of the recipient.
    @prop()
    readonly addr: Addr

    constructor(addr: Addr) {
        super()
        this.init(addr)
        this.addr = addr
    }

    @method()
    public unlock(sig: Sig, pubkey: PubKey) {
        // Check if the passed public key belongs to the specified address.
        assert(
            pubKey2Addr(pubkey) == this.addr,
            'public key hashes are not equal'
        )
        // Check signature validity.
        assert(this.checkSig(sig, pubkey), 'signature check failed')
    }

    public getNopScript(): bsv.Script | null {
        const ls = this.lockingScript
        if (Ordinal.isOrdinalP2PKHV1(ls)) {
            return bsv.Script.fromHex(ls.toHex().slice(P2PKHScriptLen))
        }

        if (Ordinal.isOrdinalP2PKHV2(ls)) {
            return this.getPrependNOPScript()
        }

        return null
    }

    static override fromLockingScript(script: string): SmartContract {
        const ls = bsv.Script.fromHex(script)

        if (!this.DelegateClazz) {
            throw new Error('no DelegateClazz found!')
        }

        let rawP2PKH = ''

        if (Ordinal.isOrdinalP2PKHV1(ls)) {
            rawP2PKH = script.slice(0, P2PKHScriptLen)
        } else if (Ordinal.isOrdinalP2PKHV2(ls)) {
            rawP2PKH = script.slice(Number(Ordinal.sizeOfOrdinal(script)) * 2)
        } else if (Ordinal.isP2PKH(script)) {
            rawP2PKH = script
        }

        const delegateInstance = this.DelegateClazz.fromHex(rawP2PKH)

        // recreate instance
        const args = delegateInstance.ctorArgs().map((arg) => {
            return arg.value
        })

        // we can't  get max, and lim from the bsv20 insciption script.
        const instance = new this(Addr(args[0] as Ripemd160))
        instance.delegateInstance = delegateInstance

        return instance
    }

    static override fromUTXO<T extends SmartContract>(
        this: new (...args: any[]) => T,
        utxo: UTXO
    ): T {
        if (utxo.satoshis !== 1) {
            throw new Error('invalid ordinal p2pkh utxo')
        }
        const ls = bsv.Script.fromHex(utxo.script)

        if (!Ordinal.isOrdinalP2PKH(ls) && !Ordinal.isP2PKH(utxo.script)) {
            throw new Error('invalid ordinal p2pkh utxo')
        }

        const instance = OneSatNFTP2PKH.fromLockingScript(utxo.script) as T
        instance.from = utxo
        return instance
    }

    public static async getLatestInstance(
        origin: string
    ): Promise<OneSatNFTP2PKH> {
        const utxo = await OneSatApis.fetchUTXOByOrigin(origin)

        if (utxo === null) {
            throw new Error('no utxo found')
        }

        return this.fromUTXO(utxo)
    }
}

const desc = {
    version: 9,
    compilerVersion: '1.19.0+commit.72eaeba',
    contract: 'OrdP2PKH',
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
                    name: 'addr',
                    type: 'Ripemd160',
                },
            ],
        },
    ],
    stateProps: [],
    buildType: 'release',
    file: '',
    hex: '76a9<addr>88ac',
    sourceMapFile: '',
}

OneSatNFTP2PKH.loadArtifact(desc)
