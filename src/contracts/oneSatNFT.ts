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
    MethodCallTxBuilder,
    MethodCallOptions,
    ContractTransaction,
    StatefulNext,
} from 'scrypt-ts'
import { Inscription, NFTReceiver, ORDMethodCallOptions } from '../types'
import { Ordinal } from './ordinal'
import { OneSatApis } from '../1satApis'
import { OrdP2PKH } from './ordP2PKH'

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

    protected override getDefaultTxBuilder(
        methodName: string
    ): MethodCallTxBuilder<this> {
        return async function (
            current: OneSatNFT,
            options_: MethodCallOptions<OneSatNFT>,
            ...args
        ): Promise<ContractTransaction> {
            const options = options_ as ORDMethodCallOptions<OneSatNFT>

            // bsv change address
            const changeAddress = await current.signer.getDefaultAddress()

            const nexts: StatefulNext<SmartContract>[] = []
            const tx = new bsv.Transaction()

            tx.addInput(current.buildContractInput())

            const recipient = options.transfer as NFTReceiver

            if (recipient instanceof SmartContract) {
                tx.addOutput(
                    new bsv.Transaction.Output({
                        script: recipient.lockingScript,
                        satoshis: 1,
                    })
                )

                nexts.push({
                    instance: recipient,
                    balance: 1,
                    atOutputIndex: nexts.length,
                })
            }

            tx.change(changeAddress)

            if (options.sequence !== undefined) {
                tx.setInputSequence(0, options.sequence)
            }

            if (options.lockTime) {
                const _sequence =
                    options.sequence !== undefined
                        ? options.sequence
                        : 0xfffffffe
                tx.setInputSequence(0, _sequence) // activate locktime interlock
                tx.setLockTime(options.lockTime)
            }

            return Promise.resolve({
                tx,
                atInputIndex: 0,
                nexts: nexts,
            })
        }
    }

    public static async getLatestInstance(
        origin: string
    ): Promise<SmartContract> {
        const utxo = await OneSatApis.fetchUTXOByOrigin(origin)

        if (utxo === null) {
            throw new Error('no utxo found')
        }

        const insciptionScript = Ordinal.getInsciptionScript(utxo.script)

        const instance = this.fromUTXO(
            utxo,
            {},
            bsv.Script.fromHex(insciptionScript)
        )
        return instance
    }
}
