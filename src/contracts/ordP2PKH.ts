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
} from 'scrypt-ts'
import { Inscription } from '../types'
import { Ordinal } from './ordinal'

export class OrdP2PKH extends SmartContract {
    // Address of the recipient.
    @prop()
    readonly addr: Addr

    private constructor(addr: Addr) {
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
        return bsv.Script.fromHex(
            Ordinal.isOrdinalP2PKHV1(ls)
                ? ls.toHex().slice(50)
                : Ordinal.getInsciptionScript(toByteString(ls.toHex()))
        )
    }
    getBSV20Amt(): bigint {
        const nopScript = this.getNopScript()
        return Ordinal.getAmt(nopScript)
    }

    getBSV20Tick(): string {
        const nopScript = this.getNopScript()
        return Ordinal.getTick(nopScript)
    }

    setNFT(inscription: Inscription) {
        this.prependNOPScript(Ordinal.create(inscription))
    }

    isBsv20(): boolean {
        const nopScript = this.getNopScript()
        const ins = Ordinal.getInsciption(nopScript)
        return ins.contentType === 'application/bsv-20'
    }

    static fromAddress(address: string | bsv.Address | bsv.PublicKey) {
        OrdP2PKH.loadArtifact(desc)
        const s = bsv.Script.buildPublicKeyHashOut(address)
        return new OrdP2PKH(Addr(toHex(s.chunks[2].buf)))
    }

    static fromP2PKHUTXO(utxo: UTXO): OrdP2PKH {
        const ls = bsv.Script.fromHex(utxo.script)

        if (!Ordinal.isOrdinalP2PKH(ls)) {
            throw new Error('invalid ordinal p2pkh utxo')
        }

        if (Ordinal.isOrdinalP2PKHV1(ls)) {
            const nopScript = bsv.Script.fromHex(utxo.script.slice(50))

            OrdP2PKH.loadArtifact(
                Object.assign({}, desc, {
                    hex: desc.hex + nopScript.toHex(),
                })
            )
            const instance = (
                this as unknown as typeof SmartContract
            ).fromLockingScript(utxo.script) as OrdP2PKH
            instance.from = utxo
            return instance
        } else {
            OrdP2PKH.loadArtifact(desc)
            const nopScript = Ordinal.getInsciptionScript(
                toByteString(utxo.script)
            )
            const instance = (
                this as unknown as typeof SmartContract
            ).fromLockingScript(
                utxo.script,
                {},
                bsv.Script.fromHex(nopScript)
            ) as OrdP2PKH
            instance.from = utxo
            return instance
        }
    }

    static fromOutPoint(outPoint: string): OrdP2PKH {
        const utxo = Ordinal.fetchUTXOByOutpoint(outPoint)
        if (utxo === null) {
            throw new Error(`no utxo found for outPoint: ${outPoint}`)
        }
        return OrdP2PKH.fromP2PKHUTXO(utxo)
    }

    async transferBsv20(
        receiver: string | bsv.Address | bsv.PublicKey,
        tokenAmt: bigint
    ): Promise<ContractTransaction> {
        const ordPubKey = await this.signer.getDefaultPubKey()
        const tick = this.getBSV20Tick()

        const totalTokenAmt = this.getBSV20Amt()
        const tokenChangeAmt = totalTokenAmt - tokenAmt
        if (tokenChangeAmt < 0n) {
            throw new Error('Not enough token!')
        }

        const receiverP2pkh = OrdP2PKH.fromAddress(receiver)
        let tokenChangeP2PKH: OrdP2PKH | null = null

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.bindTxBuilder(
            'unlock',
            async (
                current: OrdP2PKH,
                options: MethodCallOptions<OrdP2PKH>
            ): Promise<ContractTransaction> => {
                const tx = new bsv.Transaction()

                tx.addInput(current.buildContractInput())

                const nexts: StatefulNext<SmartContract>[] = []

                receiverP2pkh.setBSV20(tick, tokenAmt)

                tx.addOutput(
                    new bsv.Transaction.Output({
                        script: receiverP2pkh.lockingScript,
                        satoshis: 1,
                    })
                )

                nexts.push({
                    instance: receiverP2pkh,
                    balance: 1,
                    atOutputIndex: 0,
                })

                if (tokenChangeAmt > 0n) {
                    tokenChangeP2PKH = OrdP2PKH.fromAddress(ordPubKey)
                    tokenChangeP2PKH.setBSV20(tick, tokenChangeAmt)

                    tx.addOutput(
                        new bsv.Transaction.Output({
                            script: tokenChangeP2PKH.lockingScript,
                            satoshis: 1,
                        })
                    )

                    nexts.push({
                        instance: tokenChangeP2PKH,
                        balance: 1,
                        atOutputIndex: 1,
                    })
                }

                tx.change(ordPubKey.toAddress())

                return Promise.resolve({
                    tx: tx,
                    atInputIndex: 0,
                    nexts: nexts,
                })
            }
        )

        return this.methods['unlock'](
            (sigResps) => findSig(sigResps, ordPubKey),
            PubKey(toHex(ordPubKey)),
            {
                pubKeyOrAddrToSign: ordPubKey,
            }
        )
    }

    async transferNFT(
        receiver: string | bsv.Address | bsv.PublicKey
    ): Promise<bsv.Transaction> {
        const ordPubKey = await this.signer.getDefaultPubKey()

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.bindTxBuilder(
            'unlock',
            async (
                current: OrdP2PKH,
                options: MethodCallOptions<OrdP2PKH>
            ): Promise<ContractTransaction> => {
                const tx = new bsv.Transaction()

                tx.addInput(current.buildContractInput()).addOutput(
                    new bsv.Transaction.Output({
                        script: bsv.Script.buildPublicKeyHashOut(receiver),
                        satoshis: 1,
                    })
                )

                tx.change(ordPubKey.toAddress())

                return Promise.resolve({
                    tx: tx,
                    atInputIndex: 0,
                    nexts: [],
                })
            }
        )

        const { tx } = await this.methods['unlock'](
            (sigResps) => findSig(sigResps, ordPubKey),
            PubKey(toHex(ordPubKey)),
            {
                pubKeyOrAddrToSign: ordPubKey,
            }
        )

        return Promise.resolve(tx)
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
