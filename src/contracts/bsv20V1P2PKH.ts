/* eslint-disable @typescript-eslint/no-explicit-any */
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
    toByteString,
    pubKey2Addr,
    ByteString,
    fromByteString,
    findSig,
    ContractTransaction,
    StatefulNext,
    Signer,
    SignatureResponse,
    MethodCallOptions,
} from 'scrypt-ts'

import { Ordinal } from './ordinal'
import { OneSatApis } from '../1satApis'
import { BSV20V1 } from './bsv20V1'
import { BSV20V1_JSON, FTReceiver, OrdiMethodCallOptions } from '../types'

const P2PKHScriptLen = 50

export class BSV20V1P2PKH extends BSV20V1 {
    // Address of the recipient.
    @prop()
    readonly addr: Addr

    constructor(
        tick: ByteString,
        max: bigint,
        lim: bigint,
        dec: bigint,
        addr: Addr
    ) {
        super(tick, max, lim, dec)
        this.init(...arguments)
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

    override init(...args: any[]) {
        const [_, __, ___, ____, addr] = args
        super.init(addr)
    }

    override get lockingScript() {
        const nop = this.getNopScript()

        if (nop) {
            return new bsv.Script('')
                .add(nop)
                .add(bsv.Opcode.OP_DUP)
                .add(bsv.Opcode.OP_HASH160)
                .add(bsv.Script.fromASM(this.addr))
                .add(bsv.Opcode.OP_EQUALVERIFY)
                .add(bsv.Opcode.OP_CHECKSIG)
        }

        throw new Error('No nop script found!')
    }

    private getNopScript() {
        const nop = this.getPrependNOPScript()

        if (nop) {
            return nop
        }

        const ls = bsv.Script.fromHex(this.utxo.script)
        if (Ordinal.isOrdinalP2PKHV1(ls)) {
            return bsv.Script.fromHex(ls.toHex().slice(P2PKHScriptLen))
        }

        if (Ordinal.isOrdinalP2PKHV2(ls)) {
            return bsv.Script.fromHex(
                Ordinal.getInsciptionScript(this.utxo.script)
            )
        }
    }

    override getAmt() {
        const nop = this.getNopScript()
        if (nop) {
            return Ordinal.getAmt(nop, fromByteString(this.tick))
        }

        throw new Error('No inscription script!')
    }

    static override fromLockingScript(script: string): SmartContract {
        const ls = bsv.Script.fromHex(script)

        const DelegateClazz = this.getDelegateClazz()
        if (!DelegateClazz) {
            throw new Error('No DelegateClazz found!')
        }

        let rawP2PKH = ''

        if (Ordinal.isOrdinalP2PKHV1(ls)) {
            rawP2PKH = script.slice(0, P2PKHScriptLen)
        } else {
            rawP2PKH = script.slice(Number(Ordinal.sizeOfOrdinal(script)) * 2)
        }

        const delegateInstance = DelegateClazz.fromHex(rawP2PKH)

        const bsv20 = Ordinal.getBsv20(
            bsv.Script.fromHex(script),
            true
        ) as BSV20V1_JSON

        // recreate instance
        const args = delegateInstance.ctorArgs().map((arg) => {
            return arg.value
        })

        // we can't get max, lim, and dec from the bsv20 insciption script.
        const instance = new this(
            toByteString(bsv20.tick, true),
            -1n,
            -1n,
            -1n,
            Addr(args[0] as ByteString)
        )
        instance.setDelegateInstance(delegateInstance)

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

        if (!Ordinal.isOrdinalP2PKH(ls)) {
            throw new Error('invalid ordinal p2pkh utxo')
        }

        const instance = BSV20V1P2PKH.fromLockingScript(utxo.script) as T
        instance.from = utxo
        return instance
    }

    static async fromOutPoint(
        outPoint: string,
        network?: bsv.Networks.Network
    ): Promise<BSV20V1P2PKH> {
        const utxo = await OneSatApis.fetchUTXOByOutpoint(outPoint, network)
        if (utxo === null) {
            throw new Error(`no utxo found for outPoint: ${outPoint}`)
        }
        return BSV20V1P2PKH.fromUTXO(utxo)
    }

    /**
     * Get all unspent bsv20 p2pkh of a address by tick
     * @param tick
     * @param address
     * @returns
     */
    static async getBSV20(
        tick: string,
        address: string
    ): Promise<Array<BSV20V1P2PKH>> {
        const bsv20Utxos = await OneSatApis.fetchBSV20Utxos(address, tick)
        return bsv20Utxos.map((utxo) => BSV20V1P2PKH.fromUTXO(utxo))
    }

    /**
     * Transfer BSV20 tokens which held by multiple BSV20V1P2PKH instances
     * @param senders BSV20V1P2PKH instances
     * @param feeSigner used to sign UTXOs that pay transaction fees
     * @param receivers token receiving contract
     * @param tokenChangeAddress Token change address
     * @param sendersPubkey The sender’s public key. By default, the default public key of the Signer connected to BSV20V1P2PKH is used.
     * @returns
     */
    static async transfer(
        senders: Array<BSV20V1P2PKH>,
        feeSigner: Signer,
        receivers: Array<FTReceiver>,
        tokenChangeAddress: bsv.Address,
        sendersPubkey?: Array<bsv.PublicKey>
    ) {
        if (!senders.every((sender) => sender.tick === senders[0].tick)) {
            throw new Error('The tick of all senders must be the same!')
        }
        sendersPubkey = sendersPubkey || []

        const totalTokenAmt = senders.reduce((acc, sender) => {
            acc += BigInt(sender.getAmt())
            return acc
        }, 0n)

        const tokenAmt = receivers.reduce((acc, receiver) => {
            acc += receiver.amt
            return acc
        }, 0n)

        const tokenChangeAmt = totalTokenAmt - tokenAmt

        if (tokenChangeAmt < 0n) {
            throw new Error('Not enough token!')
        }

        const tx = new bsv.Transaction()
        const nexts: StatefulNext<SmartContract>[] = []

        const tick = senders[0].tick

        for (let i = 0; i < receivers.length; i++) {
            const receiver = receivers[i]

            if (receiver.instance instanceof BSV20V1) {
                receiver.instance.setAmt(receiver.amt)
            } else {
                throw new Error('unsupport receiver, only BSV20!')
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
                atOutputIndex: i,
            })
        }

        if (tokenChangeAmt > 0n) {
            const p2pkh = new this(
                tick,
                senders[0].max,
                senders[0].lim,
                senders[0].dec,
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

        const bsvAddress = await feeSigner.getDefaultAddress()

        const feePerKb = await feeSigner.provider?.getFeePerKb()
        tx.feePerKb(feePerKb as number)
        tx.change(bsvAddress)

        for (let i = 0; i < senders.length; i++) {
            const p2pkh = senders[i]
            p2pkh.bindTxBuilder(
                'unlock',
                async (
                    current: BSV20V1P2PKH,
                    options: MethodCallOptions<BSV20V1P2PKH>
                ): Promise<ContractTransaction> => {
                    if (options.partialContractTx?.tx) {
                        const tx = options.partialContractTx.tx
                        tx.addInput(current.buildContractInput())

                        return Promise.resolve({
                            tx: tx,
                            atInputIndex: i,
                            nexts,
                        })
                    }
                    throw new Error('No partialContractTx found!')
                }
            )

            const pubkey =
                sendersPubkey[i] || (await p2pkh.signer.getDefaultPubKey())

            await p2pkh.methods.unlock(
                (sigResps: SignatureResponse[]) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: [],
                    partialContractTx: {
                        tx: tx,
                        atInputIndex: 0,
                        nexts: [],
                    },
                    pubKeyOrAddrToSign: pubkey,
                    multiContractCall: true,
                } as OrdiMethodCallOptions<BSV20V1P2PKH>
            )
        }

        return SmartContract.multiContractCall(
            {
                tx: tx,
                atInputIndex: 0,
                nexts: nexts,
            },
            feeSigner
        )
    }
}

const desc = {
    version: 9,
    compilerVersion: '1.19.0+commit.72eaeba',
    contract: 'BSV20V1P2PKH',
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

BSV20V1P2PKH.loadArtifact(desc)
