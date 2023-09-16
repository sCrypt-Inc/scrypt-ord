/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-useless-escape */
import {
    ByteString,
    len,
    method,
    OpCode,
    slice,
    SmartContract,
    toByteString,
    Utils,
    byteString2Int,
    VarIntWriter,
    assert,
    int2ByteString,
    Addr,
    prop,
    bsv,
    MethodCallOptions,
    ContractTransaction,
    StatefulNext,
    toHex,
} from 'scrypt-ts'
import { Shift10 } from 'scrypt-ts-lib'
import { Inscription } from '../inscription'

function byteStringToStr(bs: ByteString): string {
    const encoder = new TextDecoder()
    return encoder.decode(Buffer.from(bs, 'hex'))
}

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
    build1SatStateOutput(amt: bigint): ByteString {
        const stateScript =
            BSV20V1.createTransferInsciption(this.tick, amt) +
            BSV20V1.removeInsciption(this.getStateScript())
        return Utils.buildOutput(stateScript, 1n)
    }

    @method()
    static skipBytes(b: ByteString): bigint {
        let len = 0n
        let ret = 0n
        const header: bigint = byteString2Int(slice(b, 0n, 1n))

        if (header < 0x4cn) {
            len = header
            ret = 1n + len
        } else if (header == 0x4cn) {
            len = Utils.fromLEUnsigned(slice(b, 1n, 2n))
            ret = 1n + 1n + len
        } else if (header == 0x4dn) {
            len = Utils.fromLEUnsigned(slice(b, 1n, 3n))
            ret = 1n + 2n + len
        } else if (header == 0x4en) {
            len = Utils.fromLEUnsigned(slice(b, 1n, 5n))
            ret = 1n + 4n + len
        } else {
            // shall not reach here
            ret = -1n
        }

        return ret
    }

    @method()
    static isP2PKHOrdinal(script: ByteString): boolean {
        return (
            len(script) > 25n &&
            BSV20V1.isP2PKH(slice(script, 0n, 25n)) &&
            BSV20V1.sizeOfOrdinal(slice(script, 25n)) > 0n
        )
    }

    @method()
    static isP2PKH(script: ByteString): boolean {
        return (
            len(script) === 25n &&
            slice(script, 0n, 3n) === toByteString('76a914') &&
            slice(script, 23n) === toByteString('88ac')
        )
    }

    @method()
    static removeInsciption(scriptCode: ByteString): ByteString {
        const inscriptLen = BSV20V1.sizeOfOrdinal(scriptCode)

        if (inscriptLen > 0n) {
            scriptCode = slice(scriptCode, inscriptLen)
        }
        return scriptCode
    }

    @method()
    static getInsciptionScript(scriptCode: ByteString): ByteString {
        const inscriptLen = BSV20V1.sizeOfOrdinal(scriptCode)
        let ret = toByteString('')
        if (inscriptLen > 0n) {
            ret = slice(scriptCode, 0n, inscriptLen)
        }
        return ret
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
    static sizeOfOrdinal(script: ByteString): bigint {
        let ret = -1n
        let pos = 0n
        if (
            len(script) >= 11n &&
            slice(script, pos, 7n) === toByteString('0063036f726451')
        ) {
            pos += 7n
            const contentTypeLen = BSV20V1.skipBytes(slice(script, pos))
            if (contentTypeLen > 0n) {
                pos += contentTypeLen
                if (slice(script, pos, pos + 1n) === OpCode.OP_0) {
                    pos += 1n
                    const contentLen = BSV20V1.skipBytes(slice(script, pos))

                    if (contentLen > 0n) {
                        pos += contentLen
                        if (slice(script, pos, pos + 1n) === OpCode.OP_ENDIF) {
                            pos += 1n
                            ret = pos
                        }
                    }
                }
            }
        }
        return ret
    }

    @method()
    static createInsciption(
        content: ByteString,
        contentType: ByteString
    ): ByteString {
        return (
            OpCode.OP_FALSE +
            OpCode.OP_IF +
            VarIntWriter.writeBytes(toByteString('ord', true)) +
            OpCode.OP_1 +
            VarIntWriter.writeBytes(contentType) +
            OpCode.OP_FALSE +
            VarIntWriter.writeBytes(content) +
            OpCode.OP_ENDIF
        )
    }

    @method()
    static createMintInsciption(tick: ByteString, amt: bigint): ByteString {
        const amtByteString = BSV20V1.int2Str(amt)

        const mintJSON =
            toByteString('{"p":"bsv-20","op":"mint","tick":"', true) +
            tick +
            toByteString('","amt":"', true) +
            amtByteString +
            toByteString('"}', true)

        return BSV20V1.createInsciption(
            mintJSON,
            toByteString('application/bsv-20', true)
        )
    }

    @method()
    static createTransferInsciption(tick: ByteString, amt: bigint): ByteString {
        const amtByteString = BSV20V1.int2Str(amt)

        const transferJSON =
            toByteString('{"p":"bsv-20","op":"transfer","tick":"', true) +
            tick +
            toByteString('","amt":"', true) +
            amtByteString +
            toByteString('"}', true)
        return BSV20V1.createInsciption(
            transferJSON,
            toByteString('application/bsv-20', true)
        )
    }

    @method()
    static parseInt(s: ByteString): bigint {
        let n = 0n

        const l = len(s)
        for (let i = 0n; i < 20; i++) {
            if (i < l) {
                const char = slice(s, i, i + 1n)
                const c = byteString2Int(char)
                assert(c >= 48n && c <= 57n)
                n = n * 10n + (c - 48n)
            }
        }

        return n
    }

    // Converts integer to hex-encoded ASCII.
    // 1000 -> '31303030'
    // Input cannot be larger than 2^64-1.
    @method()
    static int2Str(n: bigint): ByteString {
        // Max 2^64-1
        assert(n < 18446744073709551616n, 'n is larger than 2^64-1')

        let res = toByteString('')
        let done = false

        for (let i = 0; i < 20; i++) {
            if (!done) {
                // Get ith digit: n // 10^i % 10
                const denominator = Shift10.pow(BigInt(i))

                if (n < denominator) {
                    done = true
                } else {
                    const ithDigit = (n / denominator) % 10n

                    // Transform digit to ASCII (hex encoded) and prepend to result.
                    res = int2ByteString(48n + ithDigit, 1n) + res
                }
            }
        }

        return res
    }

    @method()
    public __scrypt__unlock() {
        assert(false, 'should not reach here!')
    }

    static toOutput(outputByteString: ByteString): bsv.Transaction.Output {
        const reader = new bsv.encoding.BufferReader(
            Buffer.from(outputByteString, 'hex')
        )
        return bsv.Transaction.Output.fromBufferReader(reader)
    }

    private static create(inscription: Inscription): bsv.Script {
        const contentTypeBytes = toByteString(inscription.contentType, true)
        const contentBytes = toByteString(inscription.content, true)
        return bsv.Script.fromASM(
            `OP_FALSE OP_IF 6f7264 OP_1 ${contentTypeBytes} OP_0 ${contentBytes} OP_ENDIF`
        )
    }

    private static createMint(tick: string, amt: bigint): bsv.Script {
        return BSV20V1.create({
            content: JSON.stringify({
                p: 'bsv-20',
                op: 'mint',
                tick,
                amt: amt.toString().replace(/n/, ''),
            }),
            contentType: 'application/bsv-20',
        })
    }

    private static createTransfer(tick: string, amt: bigint): bsv.Script {
        return BSV20V1.create({
            content: JSON.stringify({
                p: 'bsv-20',
                op: 'transfer',
                tick,
                amt: amt.toString().replace(/n/, ''),
            }),
            contentType: 'application/bsv-20',
        })
    }

    private static createDeploy(
        tick: string,
        max: bigint,
        lim: bigint
    ): bsv.Script {
        return BSV20V1.create({
            content: JSON.stringify({
                p: 'bsv-20',
                op: 'deploy',
                tick,
                max: max.toString().replace(/n/, ''),
                lim: lim.toString().replace(/n/, ''),
            }),
            contentType: 'application/bsv-20',
        })
    }

    async mint(amt: bigint) {
        if (amt > this.lim) {
            throw new Error(`amt should not be greater than "lim: ${this.lim}"`)
        }

        this.setNOPScript(BSV20V1.createMint(byteStringToStr(this.tick), amt))
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
                        BSV20V1.createDeploy(this.tick, this.max, this.lim)
                    ),
                    satoshis: 1,
                })
            )
            .change(address)

        return this.signer.signAndsendTransaction(deployTx)
    }

    private static isOrdinalContract(script: bsv.Script): boolean {
        return (
            script.chunks.length >= 8 &&
            script.chunks[0].opcodenum === bsv.Opcode.OP_0 &&
            script.chunks[1].opcodenum === bsv.Opcode.OP_IF &&
            script.chunks[2].buf &&
            script.chunks[2].buf.length === 3 &&
            script.chunks[2].buf.toString('hex') === '6f7264' &&
            script.chunks[3].opcodenum === bsv.Opcode.OP_1 &&
            script.chunks[4].buf &&
            script.chunks[5].opcodenum === bsv.Opcode.OP_0 &&
            script.chunks[6].buf &&
            script.chunks[7].opcodenum === bsv.Opcode.OP_ENDIF
        )
    }

    private static getAmt(tick: string, script: bsv.Script): bigint {
        if (BSV20V1.isOrdinalContract(script)) {
            const content = byteStringToStr(toHex(script.chunks[6].buf))
            const contentType = byteStringToStr(toHex(script.chunks[4].buf))

            if (contentType !== 'application/bsv-20') {
                throw new Error(`invalid bsv20 contentType: ${contentType}`)
            }

            const bsv20 = JSON.parse(content)

            if (bsv20.tick !== tick) {
                throw new Error(`invalid bsv20 tick, ${content}`)
            }

            if (bsv20.op === 'mint' || bsv20.op === 'transfer') {
                return BigInt(bsv20.amt)
            }

            throw new Error(`invalid bsv20 op, ${content}`)
        }

        throw new Error(`invalid 1sat ordinal`)
    }

    setAmt(amt: bigint) {
        this.setNOPScript(
            BSV20V1.createTransfer(byteStringToStr(this.tick), amt)
        )
    }

    getAmt() {
        const nop = this.getNOPScript()

        if (nop === null) {
            throw new Error('no amt setted!')
        }

        return BSV20V1.getAmt(byteStringToStr(this.tick), nop)
    }

    async transfer(
        receivers: Array<{
            instance: BSV20V1
            amt: bigint
        }>,
        methodName: string,
        ...args
    ) {
        const builder = this['_txBuilders'].has(methodName)

        if (!builder) {
            this.bindTxBuilder(
                methodName,
                async (
                    current: BSV20V1,
                    options: MethodCallOptions<BSV20V1>
                ): Promise<ContractTransaction> => {
                    const bsvChangeAddress =
                        await this.signer.getDefaultAddress()

                    const changeAmt =
                        this.getAmt() -
                        receivers.reduce((acc, receiver) => {
                            return (acc += receiver.amt)
                        }, 0n)

                    if (changeAmt < 0n) {
                        throw new Error(`Not enough tokens`)
                    }

                    const nexts: StatefulNext<BSV20V1>[] = []
                    const tx = new bsv.Transaction()

                    tx.addInput(current.buildContractInput())

                    if (changeAmt > 0n) {
                        const nextInstance = this.next()
                        nextInstance.setAmt(changeAmt)
                        tx.addOutput(
                            new bsv.Transaction.Output({
                                script: nextInstance.lockingScript,
                                satoshis: 1,
                            })
                        )

                        nexts.push({
                            instance: nextInstance,
                            balance: 1,
                            atOutputIndex: 0,
                        })
                    }

                    for (let i = 0; i < receivers.length; i++) {
                        const receiver = receivers[i]

                        await receiver.instance.connect(this.signer)

                        receiver.instance.setAmt(receiver.amt)
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

                    tx.change(bsvChangeAddress)

                    return Promise.resolve({
                        tx,
                        atInputIndex: 0,
                        nexts: nexts,
                    })
                }
            )
        }

        return this.methods[methodName](...args)
    }
}
