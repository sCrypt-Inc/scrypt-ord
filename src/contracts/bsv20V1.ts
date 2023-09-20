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
} from 'scrypt-ts'

import { Ordinal } from './ordinal'
import { signTx } from 'scryptlib'
import { OrdP2PKH } from './ordP2PKH'
import { fromByteString } from '../utils'

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
            Utils.buildPublicKeyHashScript(address) +
            BSV20V1.createTransferInsciption(tick, amt)
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

        this.prependNOPScript(
            Ordinal.createMint(fromByteString(this.tick), amt)
        )
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

    /**
     * transfer bsv20 to receivers. Each output is a receiver.
     * @param receivers
     * @param methodName
     * @param args
     * @returns
     */
    async transfer(
        receivers: Array<{
            instance: BSV20V1 | OrdP2PKH
            amt: bigint
        }>,
        methodName: string,
        ...args
    ): Promise<{
        /** The method calling tx */
        tx: bsv.Transaction
        tokenChangeP2PKH: OrdP2PKH | null
        receivers: Array<BSV20V1>
    }> {
        let tokenChangeP2PKH: OrdP2PKH | null = null
        const tokenChangeAmt =
            this.getAmt() -
            receivers.reduce((acc, receiver) => {
                return (acc += receiver.amt)
            }, 0n)
        if (tokenChangeAmt < 0n) {
            throw new Error(`Not enough tokens`)
        }

        const builder = this['_txBuilders'].has(methodName)

        if (!builder) {
            this.bindTxBuilder(
                methodName,
                async (
                    current: BSV20V1,
                    options: MethodCallOptions<BSV20V1>
                ): Promise<ContractTransaction> => {
                    // bsv change address
                    const changeAddress = await this.signer.getDefaultAddress()

                    const nexts: StatefulNext<SmartContract>[] = []
                    const tx = new bsv.Transaction()

                    tx.addInput(current.buildContractInput())

                    for (let i = 0; i < receivers.length; i++) {
                        const receiver = receivers[i]

                        await receiver.instance.connect(this.signer)

                        if (receiver.instance instanceof BSV20V1) {
                            receiver.instance.setAmt(receiver.amt)
                        } else if (receiver.instance instanceof OrdP2PKH) {
                            receiver.instance.setBSV20(
                                fromByteString(this.tick),
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

                    if (tokenChangeAmt > 0n) {
                        const changeAddress =
                            await this.signer.getDefaultAddress()
                        const p2pkh = OrdP2PKH.fromAddress(changeAddress)

                        p2pkh.setBSV20(
                            fromByteString(this.tick),
                            tokenChangeAmt
                        )
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

                        tokenChangeP2PKH = p2pkh
                    }

                    tx.change(changeAddress)

                    return Promise.resolve({
                        tx,
                        atInputIndex: 0,
                        nexts: nexts,
                    })
                }
            )
        }

        const { tx, nexts } = await this.methods[methodName](...args)

        return Promise.resolve({
            tx,
            tokenChangeP2PKH,
            receivers: nexts.slice(0, receivers.length).map((n) => n.instance),
        })
    }

    static async getOrdP2PKHs(
        tick: string,
        address: string
    ): Promise<Array<OrdP2PKH>> {
        const bsv20Utxos = await Ordinal.fetchBSV20Utxos(address, tick)
        return bsv20Utxos.map((utxo) => OrdP2PKH.fromP2PKHUTXO(utxo))
    }
    static async send2Contract(
        ordP2PKHs: Array<OrdP2PKH>,
        ordSigner: Signer,
        instance: BSV20V1,
        tokenAmt: bigint
    ): Promise<bsv.Transaction> {
        const ordPubKey = await ordSigner.getDefaultPubKey()

        const totalTokenAmt = ordP2PKHs.reduce((acc, ordP2PKH) => {
            acc += BigInt(ordP2PKH.getBSV20Amt())
            return acc
        }, 0n)

        const tokenChangeAmt = totalTokenAmt - tokenAmt

        if (tokenChangeAmt < 0n) {
            throw new Error('Not enough token!')
        }

        const tx = new bsv.Transaction()

        for (let i = 0; i < ordP2PKHs.length; i++) {
            const p2pkh = ordP2PKHs[i]
            p2pkh.bindTxBuilder(
                'unlock',
                async (
                    current: OrdP2PKH,
                    options: MethodCallOptions<OrdP2PKH>
                ): Promise<ContractTransaction> => {
                    const tx = options.partialContractTx.tx
                    tx.addInput(current.buildContractInput())

                    const nexts: StatefulNext<SmartContract>[] = []
                    if (i === ordP2PKHs.length - 1) {
                        instance.prependNOPScript(
                            Ordinal.createTransfer(
                                fromByteString(instance.tick),
                                tokenAmt
                            )
                        )

                        tx.addOutput(
                            new bsv.Transaction.Output({
                                script: instance.lockingScript,
                                satoshis: 1,
                            })
                        )

                        nexts.push({
                            instance,
                            balance: 1,
                            atOutputIndex: 0,
                        })

                        if (tokenChangeAmt > 0n) {
                            const p2pkh = OrdP2PKH.fromAddress(ordPubKey)

                            p2pkh.setBSV20(
                                fromByteString(instance.tick),
                                tokenChangeAmt
                            )

                            tx.addOutput(
                                new bsv.Transaction.Output({
                                    script: p2pkh.lockingScript,
                                    satoshis: 1,
                                })
                            )

                            nexts.push({
                                instance,
                                balance: 1,
                                atOutputIndex: 1,
                            })
                        }

                        tx.change(ordPubKey.toAddress())
                    }
                    return Promise.resolve({
                        tx: tx,
                        atInputIndex: i,
                        nexts: nexts,
                    })
                }
            )

            await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, ordPubKey),
                PubKey(toHex(ordPubKey)),
                {
                    partialContractTx: {
                        tx: tx,
                        atInputIndex: 0,
                        nexts: [],
                    },
                    pubKeyOrAddrToSign: ordPubKey,
                    multiContractCall: true,
                } as MethodCallOptions<OrdP2PKH>
            )
        }

        const { tx: callTx } = await SmartContract.multiContractCall(
            {
                tx: tx,
                atInputIndex: 0,
                nexts: [],
            },
            ordSigner
        )

        return callTx
    }
}
