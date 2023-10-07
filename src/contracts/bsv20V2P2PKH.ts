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
    MethodCallOptions,
    findSig,
    ContractTransaction,
    StatefulNext,
    Signer,
    toHex,
} from 'scrypt-ts'

import { Ordinal } from './ordinal'
import { OneSatApis } from '../1satApis'
import {
    BSV20V1_JSON,
    BSV20V2_JSON,
    BSV20V2_TRANSFER_JSON,
    FTReceiver,
} from '../types'
import { BSV20V2 } from './bsv20V2'

const P2PKHScriptLen = 50

export class BSV20V2P2PKH extends BSV20V2 {
    // Address of the recipient.
    @prop()
    readonly addr: Addr

    constructor(id: ByteString, amt: bigint, dec: bigint, addr: Addr) {
        super(id, amt, dec)
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
        const [id, _, __, addr] = args
        this.id = id
        super.init(addr)
    }

    override get lockingScript() {
        const nop = this.getNopScript()

        if (nop) {
            return new bsv.Script('')
                .add(bsv.Opcode.OP_DUP)
                .add(bsv.Opcode.OP_HASH160)
                .add(bsv.Script.fromASM(this.addr))
                .add(bsv.Opcode.OP_EQUALVERIFY)
                .add(bsv.Opcode.OP_CHECKSIG)
                .add(nop)
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
        return Ordinal.getAmtV2(nop)
    }

    static override fromLockingScript(script: string): SmartContract {
        const ls = bsv.Script.fromHex(script)

        if (!this.getDelegateClazz()) {
            throw new Error('no DelegateClazz found!')
        }

        let rawP2PKH = ''

        if (Ordinal.isOrdinalP2PKHV1(ls)) {
            rawP2PKH = script.slice(0, P2PKHScriptLen)
        } else {
            rawP2PKH = script.slice(Number(Ordinal.sizeOfOrdinal(script)) * 2)
        }

        const delegateInstance = this.getDelegateClazz().fromHex(rawP2PKH)

        const bsv20 = Ordinal.getBsv20(
            bsv.Script.fromHex(script),
            false
        ) as BSV20V2_TRANSFER_JSON

        // recreate instance
        const args = delegateInstance.ctorArgs().map((arg) => {
            return arg.value
        })

        // we can't  get max, and lim from the bsv20 insciption script.
        const instance = new this(
            toByteString(bsv20.id, true),
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

        const instance = BSV20V2P2PKH.fromLockingScript(utxo.script) as T
        instance.from = utxo
        return instance
    }

    static fromOutPoint(outPoint: string): BSV20V2P2PKH {
        const utxo = OneSatApis.fetchUTXOByOutpoint(outPoint)
        if (utxo === null) {
            throw new Error(`no utxo found for outPoint: ${outPoint}`)
        }
        return BSV20V2P2PKH.fromUTXO(utxo)
    }

    /**
     * Get all unspent bsv20 p2pkh of a address by id
     * @param id
     * @param address
     * @returns
     */
    static async getBSV20(
        id: string,
        address: string
    ): Promise<Array<BSV20V2P2PKH>> {
        const bsv20Utxos = await OneSatApis.fetchBSV20V2Utxos(address, id)
        return bsv20Utxos.map((utxo) => BSV20V2P2PKH.fromUTXO(utxo))
    }

    static async transfer(
        senders: Array<BSV20V2P2PKH>,
        signer: Signer,
        receivers: Array<FTReceiver>
    ) {
        const ordPubKey = await signer.getDefaultPubKey()

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

        const id = senders[0].id

        for (let i = 0; i < receivers.length; i++) {
            const receiver = receivers[i]

            if (receiver.instance instanceof BSV20V2) {
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
            const p2pkh = new BSV20V2P2PKH(
                id,
                senders[0].max,
                senders[0].dec,
                Addr(ordPubKey.toAddress().toByteString())
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

        tx.change(ordPubKey.toAddress())

        for (let i = 0; i < senders.length; i++) {
            const p2pkh = senders[i]
            p2pkh.bindTxBuilder(
                'unlock',
                async (
                    current: BSV20V2P2PKH,
                    options: MethodCallOptions<BSV20V2P2PKH>
                ): Promise<ContractTransaction> => {
                    const tx = options.partialContractTx.tx
                    tx.addInput(current.buildContractInput())

                    return Promise.resolve({
                        tx: tx,
                        atInputIndex: i,
                        nexts,
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
                } as MethodCallOptions<BSV20V2P2PKH>
            )
        }

        return SmartContract.multiContractCall(
            {
                tx: tx,
                atInputIndex: 0,
                nexts: nexts,
            },
            signer
        )
    }
}

const desc = {
    version: 9,
    compilerVersion: '1.19.0+commit.72eaeba',
    contract: 'BSV20V2P2PKH',
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

BSV20V2P2PKH.loadArtifact(desc)
