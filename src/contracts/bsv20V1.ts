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
    toHex,
    UTXO,
    findSig,
    PubKey,
    Signer,
    SignatureHashType,
    MethodCallTxBuilder,
} from 'scrypt-ts'

import { Ordinal } from './ordinal'
import { OrdP2PKH } from './ordP2PKH'
import { fromByteString } from '../utils'
import { OneSatApis } from '../1satApis'
import { ORDMethodCallOptions, FTReceiver } from '../types'

/**
 * A base class implementing the bsv20 v1 protocol
 */
export class BSV20V1 extends SmartContract {
    @prop(true)
    isBSV20V1: boolean
    /** Ticker: 4 letter identifier of the bsv-20 */
    @prop()
    readonly tick: ByteString

    /** Max supply: set max supply of the bsv-20 */
    readonly max: bigint

    /** Mint limit: If letting users mint to themselves, limit per ordinal. If ommitted or 0, mint amt us unlimited. */
    readonly lim: bigint

    constructor(tick: ByteString, max: bigint, lim: bigint) {
        super(...arguments)
        this.tick = tick
        this.max = max
        this.lim = lim
        this.isBSV20V1 = true
    }

    @method()
    buildStateOutputFT(amt: bigint): ByteString {
        const stateScript =
            BSV20V1.createTransferInsciption(this.tick, amt) +
            Ordinal.removeInsciption(this.getStateScript())
        return Utils.buildOutput(stateScript, 1n)
    }

    @method()
    static buildTransferOutput(
        address: Addr,
        tick: ByteString,
        amt: bigint
    ): ByteString {
        const transferScript =
            BSV20V1.createTransferInsciption(tick, amt) +
            Utils.buildPublicKeyHashScript(address)
        return Utils.buildOutput(transferScript, 1n)
    }

    @method()
    static createMintInsciption(tick: ByteString, amt: bigint): ByteString {
        const amtByteString = Ordinal.int2Str(amt)

        const mintJSON =
            toByteString('{"p":"bsv-20","op":"mint","tick":"', true) +
            tick +
            toByteString('","amt":"', true) +
            amtByteString +
            toByteString('"}', true)

        return Ordinal.createInsciption(
            mintJSON,
            toByteString('application/bsv-20', true)
        )
    }

    @method()
    static createTransferInsciption(tick: ByteString, amt: bigint): ByteString {
        const amtByteString = Ordinal.int2Str(amt)

        const transferJSON =
            toByteString('{"p":"bsv-20","op":"transfer","tick":"', true) +
            tick +
            toByteString('","amt":"', true) +
            amtByteString +
            toByteString('"}', true)
        return Ordinal.createInsciption(
            transferJSON,
            toByteString('application/bsv-20', true)
        )
    }

    @method()
    public __scrypt_ts_base_unlock() {
        assert(false, 'should not reach here!')
    }

    async mint(amt: bigint) {
        if (amt > this.lim) {
            throw new Error(`amt should not be greater than "lim: ${this.lim}"`)
        }

        this.setAmt(amt)
        return this.deploy(1)
    }

    async deployToken() {
        const address = await this.signer.getDefaultAddress()

        const utxos = await this.signer.listUnspent(address)

        const deployTx = new bsv.Transaction()
            .from(utxos)
            .addOutput(
                new bsv.Transaction.Output({
                    script: bsv.Script.buildPublicKeyHashOut(address).add(
                        Ordinal.createDeploy(this.tick, this.max, this.lim)
                    ),
                    satoshis: 1,
                })
            )
            .change(address)

        return this.signer.signAndsendTransaction(deployTx)
    }

    setAmt(amt: bigint) {
        this.prependNOPScript(
            Ordinal.createTransfer(fromByteString(this.tick), amt)
        )
        return this
    }

    getAmt() {
        const nopScript = this.getPrependNOPScript()

        if (nopScript === null) {
            throw new Error('no amt setted!')
        }

        return Ordinal.getAmt(nopScript, fromByteString(this.tick))
    }

    protected override getDefaultTxBuilder(
        methodName: string
    ): MethodCallTxBuilder<this> {
        return async function (
            current: BSV20V1,
            options_: MethodCallOptions<BSV20V1>,
            ...args
        ): Promise<ContractTransaction> {
            const options = options_ as ORDMethodCallOptions<BSV20V1>
            const recipients = options.transfer as
                | Array<FTReceiver>
                | FTReceiver
            const tokenChangeAmt = Array.isArray(recipients)
                ? current.getAmt() -
                  recipients.reduce((acc, receiver) => {
                      return (acc += receiver.amt)
                  }, 0n)
                : recipients.amt
            if (tokenChangeAmt < 0n) {
                throw new Error(`Not enough tokens`)
            }

            // bsv change address
            const changeAddress = await current.signer.getDefaultAddress()

            const nexts: StatefulNext<SmartContract>[] = []
            const tx = new bsv.Transaction()

            tx.addInput(current.buildContractInput())

            function addReceiver(receiver: FTReceiver) {
                if (receiver.instance instanceof BSV20V1) {
                    receiver.instance.setAmt(receiver.amt)
                } else if (receiver.instance instanceof OrdP2PKH) {
                    receiver.instance.setBSV20(
                        fromByteString(current.tick),
                        receiver.amt
                    )
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
                const p2pkh = OrdP2PKH.fromAddress(tokenChangeAddress)

                p2pkh.setBSV20(fromByteString(current.tick), tokenChangeAmt)
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

    static fromBsv20(utxo: UTXO): BSV20V1 {
        const ls = bsv.Script.fromHex(utxo.script)

        if (utxo.satoshis !== 1) {
            throw new Error('invalid ordinal bsv20 utxo')
        }

        const ins = Ordinal.getInsciptionScript(utxo.script)

        if (!ins) {
            throw new Error('invalid ordinal bsv20 utxo')
        }

        const nopScript = bsv.Script.fromHex(ins)

        return this.fromUTXO(utxo, {}, nopScript)
    }
}
