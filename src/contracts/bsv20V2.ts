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
    Addr,
    prop,
    bsv,
    MethodCallOptions,
    ContractTransaction,
    StatefulNext,
    UTXO,
    MethodCallTxBuilder,
} from 'scrypt-ts'

import { Ordinal } from './ordinal'
import { fromByteString } from '../utils'
import { ORDMethodCallOptions, FTReceiver, BSV20V2_JSON } from '../types'

/**
 * A base class implementing the bsv20 v1 protocol
 */
export abstract class BSV20V2 extends SmartContract {
    /** Ticker: identifier of the bsv-20 */
    @prop(true)
    id: ByteString

    @prop()
    /** Max supply: max 2^64-1 */
    readonly max: bigint

    @prop()
    /** Decimals: set decimal precision, defaults to 0. This is different from BRC20 which defaults to 18. */
    readonly dec: bigint

    constructor(id: ByteString, max: bigint, dec: bigint) {
        super(...arguments)
        this.max = max
        this.dec = dec
        this.id = id
    }

    @method()
    buildStateOutputFT(amt: bigint): ByteString {
        if (this.isGenesis()) {
            this.initId()
        }

        const stateScript =
            BSV20V2.createTransferInsciption(this.id, amt) +
            Ordinal.removeInsciption(this.getStateScript())
        return Utils.buildOutput(stateScript, 1n)
    }

    @method()
    isGenesis(): boolean {
        return this.id === toByteString('')
    }

    @method()
    static buildTransferOutput(
        address: Addr,
        id: ByteString,
        amt: bigint
    ): ByteString {
        const transferScript =
            BSV20V2.createTransferInsciption(id, amt) +
            Utils.buildPublicKeyHashScript(address)
        return Utils.buildOutput(transferScript, 1n)
    }

    @method()
    static createTransferInsciption(id: ByteString, amt: bigint): ByteString {
        const amtByteString = Ordinal.int2Str(amt)

        const transferJSON =
            toByteString('{"p":"bsv-20","op":"transfer","id":"', true) +
            id +
            toByteString('","amt":"', true) +
            amtByteString +
            toByteString('"}', true)
        return Ordinal.createInsciption(
            transferJSON,
            toByteString('application/bsv-20', true)
        )
    }

    @method()
    initId(): void {
        this.id =
            Ordinal.txId2str(this.ctx.utxo.outpoint.txid) +
            toByteString('_', true) +
            Ordinal.int2Str(this.ctx.utxo.outpoint.outputIndex)
    }

    getTokenId(): string {
        if (this.id) {
            return fromByteString(this.id)
        }
        const nop = this.getPrependNOPScript()

        if (nop) {
            const bsv20 = Ordinal.getBsv20(nop, false) as BSV20V2_JSON

            if (bsv20.op === 'deploy+mint') {
                return `${this.utxo.txId}_${this.utxo.outputIndex}`
            } else {
                return bsv20.id
            }
        }

        throw new Error('token id is not initialized!')
    }

    async deployToken(): Promise<string> {
        if (this.id !== toByteString('')) {
            throw new Error(
                'contract instance to deploy token should not have a id!'
            )
        }

        this.prependNOPScript(Ordinal.createDeployV2(this.max, this.dec))

        const tx = await this.deploy(1)
        return `${tx.id}_0`
    }

    setAmt(amt: bigint) {
        const id = this.getTokenId()
        if (!id) {
            throw new Error('no token id!')
        }

        this.prependNOPScript(
            Ordinal.createTransferV2(fromByteString(this.id), amt)
        )
        return this
    }

    getAmt() {
        const nopScript = this.getPrependNOPScript()

        if (nopScript === null) {
            throw new Error('no amt setted!')
        }

        return Ordinal.getAmtV2(nopScript)
    }

    protected override getDefaultTxBuilder(
        methodName: string
    ): MethodCallTxBuilder<this> {
        return async function (
            current: BSV20V2,
            options_: MethodCallOptions<BSV20V2>,
            ...args
        ): Promise<ContractTransaction> {
            const options = options_ as ORDMethodCallOptions<BSV20V2>
            const recipients = options.transfer as
                | Array<FTReceiver>
                | FTReceiver
            const tokenChangeAmt = Array.isArray(recipients)
                ? current.getAmt() -
                  recipients.reduce((acc, receiver) => {
                      return (acc += receiver.amt)
                  }, 0n)
                : current.getAmt() - recipients.amt
            if (tokenChangeAmt < 0n) {
                throw new Error(`Not enough tokens`)
            }

            // bsv change address
            const changeAddress = await current.signer.getDefaultAddress()

            const nexts: StatefulNext<SmartContract>[] = []
            const tx = new bsv.Transaction()

            tx.addInput(current.buildContractInput())

            function addReceiver(receiver: FTReceiver) {
                if (receiver.instance instanceof BSV20V2) {
                    receiver.instance.setAmt(receiver.amt)
                } else {
                    throw new Error('unsupport receiver!')
                }

                tx.addOutput(
                    new bsv.Transaction.Output({
                        script: receiver.instance.lockingScript,
                        satoshis: 1,
                    })
                )

                nexts.push({
                    instance: receiver.instance,
                    balance: 1,
                    atOutputIndex: nexts.length,
                })
            }
            if (Array.isArray(recipients)) {
                for (let i = 0; i < recipients.length; i++) {
                    const receiver = recipients[i]
                    addReceiver(receiver)
                }
            } else {
                addReceiver(recipients)
            }

            if (tokenChangeAmt > 0n && options.skipTokenChange !== true) {
                const tokenChangeAddress = options.tokenChangeAddress
                    ? options.tokenChangeAddress
                    : await current.signer.getDefaultAddress()

                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { BSV20V2P2PKH } = require('./bsv20V2P2PKH')
                const p2pkh = new BSV20V2P2PKH(
                    toByteString(current.getTokenId(), true),
                    current.max,
                    current.dec,
                    Addr(tokenChangeAddress.toByteString())
                )

                p2pkh.setAmt(tokenChangeAmt)
                tx.addOutput(
                    new bsv.Transaction.Output({
                        script: p2pkh.lockingScript,
                        satoshis: 1,
                    })
                )

                nexts.push({
                    instance: p2pkh,
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

    static override fromUTXO<T extends SmartContract>(
        this: new (...args: any[]) => T,
        utxo: UTXO
    ): T {
        if (utxo.satoshis !== 1) {
            throw new Error('invalid ordinal bsv20 utxo')
        }

        const ins = Ordinal.getInsciptionScript(utxo.script)

        if (!ins) {
            throw new Error('invalid ordinal bsv20 utxo')
        }

        const nopScript = bsv.Script.fromHex(ins)

        const instance = (
            this as unknown as typeof SmartContract
        ).fromLockingScript(utxo.script, {}, nopScript) as T
        instance.from = utxo
        return instance
    }
}
