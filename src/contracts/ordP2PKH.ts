/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    assert,
    hash160,
    method,
    prop,
    PubKey,
    Sig,
    bsv,
    Addr,
    toHex,
    SmartContract,
    UTXO,
    toByteString,
    StatefulNext,
    findSig,
    ContractTransaction,
    MethodCallOptions,
    pubKey2Addr,
    fromByteString,
    MethodCallTxBuilder,
} from 'scrypt-ts'
import {
    ORDMethodCallOptions,
    FTReceiver,
    Inscription,
    NFTReceiver,
} from '../types'
import { Ordinal } from './ordinal'
import { OneSatApis } from '../1satApis'
import { BSV20V1 } from './bsv20V1'

const P2PKHScriptLen = 50

export class OrdP2PKH extends SmartContract {
    // Address of the recipient.
    @prop()
    readonly addr: Addr

    constructor(addr: Addr) {
        super(...arguments)
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

    setBSV20(tick: string, amt: bigint) {
        this.prependNOPScript(Ordinal.createTransfer(tick, amt))
    }

    private getNopScript() {
        const ls = this.lockingScript
        if (Ordinal.isOrdinalP2PKHV1(ls)) {
            return bsv.Script.fromHex(ls.toHex().slice(P2PKHScriptLen))
        }

        if (Ordinal.isOrdinalP2PKHV2(ls)) {
            return this.getPrependNOPScript()
        }

        return null
    }
    getBSV20Amt(): bigint {
        if (!this.isBsv20()) {
            throw new Error('No bsv20 json found!')
        }
        const nopScript = this.getNopScript()
        return Ordinal.getAmt(nopScript)
    }

    getBSV20Tick(): string {
        if (!this.isBsv20()) {
            throw new Error('No bsv20 json found!')
        }
        const nopScript = this.getNopScript()
        return Ordinal.getTick(nopScript)
    }

    setNFT(inscription: Inscription) {
        this.prependNOPScript(Ordinal.create(inscription))
    }

    isBsv20(): boolean {
        const nopScript = this.getNopScript()
        if (!nopScript) {
            return false
        }
        const ins = Ordinal.getInsciption(nopScript)
        return ins.contentType === 'application/bsv-20'
    }

    static fromAddress(address: string | bsv.Address | bsv.PublicKey) {
        let addr: Addr
        if (typeof address === 'string') {
            addr = Addr(bsv.Address.fromString(address).toByteString())
        } else if (address instanceof bsv.Address) {
            addr = Addr(address.toByteString())
        } else {
            addr = Addr(bsv.Address.fromPublicKey(address).toByteString())
        }
        OrdP2PKH.loadArtifact(desc)
        return new OrdP2PKH(addr)
    }

    static fromP2PKH(utxo: UTXO): OrdP2PKH {
        const ls = bsv.Script.fromHex(utxo.script)

        if (utxo.satoshis !== 1) {
            throw new Error('invalid ordinal p2pkh utxo')
        }

        if (ls.isPublicKeyHashOut()) {
            // may hold NFT
            OrdP2PKH.loadArtifact(desc)
            return OrdP2PKH.fromUTXO(utxo)
        }

        if (!Ordinal.isOrdinalP2PKH(ls)) {
            throw new Error('invalid ordinal p2pkh utxo')
        }

        if (Ordinal.isOrdinalP2PKHV1(ls)) {
            const nopScript = bsv.Script.fromHex(
                utxo.script.slice(P2PKHScriptLen)
            )

            OrdP2PKH.loadArtifact(
                Object.assign({}, desc, {
                    hex: desc.hex + nopScript.toHex(),
                })
            )

            const instance = OrdP2PKH.fromUTXO(utxo)

            // must restore v2 desc
            OrdP2PKH.loadArtifact(desc)
            return instance
        } else {
            OrdP2PKH.loadArtifact(desc)
            const nopScript = Ordinal.getInsciptionScript(
                toByteString(utxo.script)
            )

            return OrdP2PKH.fromUTXO(utxo, {}, bsv.Script.fromHex(nopScript))
        }
    }

    static fromOutPoint(outPoint: string): OrdP2PKH {
        const utxo = OneSatApis.fetchUTXOByOutpoint(outPoint)
        if (utxo === null) {
            throw new Error(`no utxo found for outPoint: ${outPoint}`)
        }
        return OrdP2PKH.fromP2PKH(utxo)
    }

    private getBSV20DefaultTxBuilder(
        methodName: string
    ): MethodCallTxBuilder<this> {
        return async function (
            current: OrdP2PKH,
            options_: MethodCallOptions<OrdP2PKH>,
            ...args
        ): Promise<ContractTransaction> {
            const options = options_ as ORDMethodCallOptions<OrdP2PKH>

            const recipients = options.transfer as
                | Array<FTReceiver>
                | FTReceiver
            const tokenChangeAmt = Array.isArray(recipients)
                ? current.getBSV20Amt() -
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
                        current.getBSV20Tick(),
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

                p2pkh.setBSV20(
                    fromByteString(current.getBSV20Tick()),
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

    private getNFTDefaultTxBuilder(
        methodName: string
    ): MethodCallTxBuilder<this> {
        return async function (
            current: OrdP2PKH,
            options_: MethodCallOptions<OrdP2PKH>,
            ...args
        ): Promise<ContractTransaction> {
            const options = options_ as ORDMethodCallOptions<OrdP2PKH>
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

    protected override getDefaultTxBuilder(
        methodName: string
    ): MethodCallTxBuilder<this> {
        if (this.isBsv20()) {
            return this.getBSV20DefaultTxBuilder(methodName)
        } else {
            return this.getNFTDefaultTxBuilder(methodName)
        }
    }

    public static async getLatestInstance(
        origin: string
    ): Promise<SmartContract> {
        const utxo = await OneSatApis.fetchUTXOByOrigin(origin)

        if (utxo === null) {
            throw new Error('no utxo found')
        }

        return this.fromP2PKH(utxo)
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

OrdP2PKH.loadArtifact(desc)
