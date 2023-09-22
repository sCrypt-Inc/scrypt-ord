/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-useless-escape */
import {
    ByteString,
    method,
    SmartContract,
    toByteString,
    Utils,
    assert,
    prop,
    bsv,
} from 'scrypt-ts'
import { Inscription } from '../types'
import { Ordinal } from './ordinal'
import { OneSatApis } from '../1satApis'

export class OneSatNFT extends SmartContract {
    @prop(true)
    isOneSatNFT: boolean

    constructor() {
        super()
        this.isOneSatNFT = true
    }

    @method()
    buildStateOutputNFT(): ByteString {
        const stateScript = Ordinal.removeInsciption(this.getStateScript())
        return Utils.buildOutput(stateScript, 1n)
    }

    @method()
    static buildMintNFTOutput(
        script: ByteString,
        content: ByteString,
        contentType: ByteString
    ): ByteString {
        const part1 = Ordinal.createInsciption(content, contentType)
        const part2 = Ordinal.removeInsciption(script)
        return Utils.buildOutput(part1 + part2, 1n)
    }

    @method()
    public __scrypt_ts_base_unlock() {
        assert(false, 'should not reach here!')
    }

    static create(inscription: Inscription): bsv.Script {
        const contentTypeBytes = toByteString(inscription.contentType, true)
        const contentBytes = toByteString(inscription.content, true)
        return bsv.Script.fromASM(
            `OP_FALSE OP_IF 6f7264 OP_1 ${contentTypeBytes} OP_0 ${contentBytes} OP_ENDIF`
        )
    }

    async mint(inscription: Inscription) {
        this.prependNOPScript(OneSatNFT.create(inscription))
        return this.deploy(1)
    }

    async mintTextNft(text: string) {
        return this.mint({
            content: text,
            contentType: 'text/plain',
        })
    }

    public static async getLatestInstanceByOrigin<T extends OneSatNFT>(
        clazz: new (...args: any) => T,
        origin: string
    ): Promise<T> {
        const utxo = await OneSatApis.fetchLatestUTXOByOrigin(origin)

        if (utxo === null) {
            throw new Error('no utxo found')
        }

        const insciptionScript = Ordinal.getInsciptionScript(utxo.script)

        const instance = (clazz as unknown as typeof OneSatNFT).fromUTXO(
            utxo,
            {},
            bsv.Script.fromHex(insciptionScript)
        )
        return instance as T
    }
}
