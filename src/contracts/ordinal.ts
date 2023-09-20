import {
    ByteString,
    len,
    method,
    OpCode,
    slice,
    toByteString,
    Utils,
    byteString2Int,
    VarIntWriter,
    assert,
    int2ByteString,
    SmartContractLib,
    UTXO,
    bsv,
    toHex,
} from 'scrypt-ts'
import { Shift10 } from 'scrypt-ts-lib'
import superagent from 'superagent'
import { BSV20Protocol, Inscription } from '../types'
import { fromByteString, handlerApiError } from '../utils'

export class Ordinal extends SmartContractLib {
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
            Ordinal.isP2PKH(slice(script, 0n, 25n)) &&
            Ordinal.sizeOfOrdinal(slice(script, 25n)) > 0n
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
        const inscriptLen = Ordinal.sizeOfOrdinal(scriptCode)

        if (inscriptLen > 0n) {
            scriptCode = slice(scriptCode, inscriptLen)
        }
        return scriptCode
    }

    @method()
    static getInsciptionScript(scriptCode: ByteString): ByteString {
        const inscriptLen = Ordinal.sizeOfOrdinal(scriptCode)
        let ret = toByteString('')
        if (inscriptLen > 0n) {
            ret = slice(scriptCode, 0n, inscriptLen)
        }
        return ret
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
            const contentTypeLen = Ordinal.skipBytes(slice(script, pos))
            if (contentTypeLen > 0n) {
                pos += contentTypeLen
                if (slice(script, pos, pos + 1n) === OpCode.OP_0) {
                    pos += 1n
                    const contentLen = Ordinal.skipBytes(slice(script, pos))

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

    static fetchUTXOByOutpoint(outpoint: string): UTXO | null {
        const url = `https://ordinals.gorillapool.io/api/inscriptions/outpoint/${outpoint}`

        return superagent
            .get(url)
            .then(function (response) {
                // handle success
                const script = Buffer.from(
                    response.body.script,
                    'base64'
                ).toString('hex')
                return {
                    txId: response.body.txid,
                    outputIndex: response.body.vout,
                    satoshis: 1,
                    script,
                }
            })
            .catch(function (error) {
                // handle error
                handlerApiError(error)
                return null
            })
    }

    static async fetchLatestUTXOByOrigin(origin: string): Promise<UTXO | null> {
        const url = `https://ordinals.gorillapool.io/api/inscriptions/origin/${origin}/latest`

        const { outpoint, spend } = await superagent
            .get(url)
            .then(function (response) {
                // handle success
                return response.body
            })
            .catch(function (error) {
                // handle error
                handlerApiError(error)
                return null
            })

        if (spend) {
            return null
        }

        return Ordinal.fetchUTXOByOutpoint(outpoint)
    }

    static async fetchOriginById(id: bigint): Promise<string | null> {
        const url = `https://ordinals.gorillapool.io/api/inscriptions/${id}`

        const { origin } = await superagent
            .get(url)
            .then(function (response) {
                // handle success
                return response.body
            })
            .catch(function (error) {
                // handle error
                handlerApiError(error)
                return null
            })

        return origin
    }

    static fetchBSV20Utxos(
        address: string,
        tick: string
    ): Promise<Array<UTXO>> {
        const url = `https://ordinals.gorillapool.io/api/utxos/address/${address}/tick/${tick}`

        return superagent
            .get(url)
            .then(function (response) {
                // handle success
                if (Array.isArray(response.body)) {
                    return Promise.all(
                        response.body.map(async (utxo) => {
                            const inscription =
                                await Ordinal.fetchUTXOByOutpoint(utxo.outpoint)
                            return {
                                txId: utxo.txid,
                                outputIndex: utxo.vout,
                                script: inscription.script,
                                satoshis: 1,
                            }
                        })
                    )
                }
                return []
            })
            .catch(function (error) {
                handlerApiError(error)
                return []
            })
    }

    static toOutput(outputByteString: ByteString): bsv.Transaction.Output {
        const reader = new bsv.encoding.BufferReader(
            Buffer.from(outputByteString, 'hex')
        )
        return bsv.Transaction.Output.fromBufferReader(reader)
    }

    static create(inscription: Inscription): bsv.Script {
        const contentTypeBytes = toByteString(inscription.contentType, true)
        const contentBytes = toByteString(inscription.content, true)
        return bsv.Script.fromASM(
            `OP_FALSE OP_IF 6f7264 OP_1 ${contentTypeBytes} OP_0 ${contentBytes} OP_ENDIF`
        )
    }

    static createMint(tick: string, amt: bigint): bsv.Script {
        return Ordinal.create({
            content: JSON.stringify({
                p: 'bsv-20',
                op: 'mint',
                tick,
                amt: amt.toString().replace(/n/, ''),
            }),
            contentType: 'application/bsv-20',
        })
    }

    static createTransfer(tick: string, amt: bigint): bsv.Script {
        return Ordinal.create({
            content: JSON.stringify({
                p: 'bsv-20',
                op: 'transfer',
                tick,
                amt: amt.toString().replace(/n/, ''),
            }),
            contentType: 'application/bsv-20',
        })
    }

    static createDeploy(tick: string, max: bigint, lim: bigint): bsv.Script {
        return Ordinal.create({
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

    static isOrdinalP2PKHV1(script: bsv.Script): boolean {
        return (
            script.chunks.length === 13 &&
            script.chunks[0].opcodenum === bsv.Opcode.OP_DUP &&
            script.chunks[1].opcodenum === bsv.Opcode.OP_HASH160 &&
            script.chunks[2].buf &&
            script.chunks[2].buf.length === 20 &&
            script.chunks[3].opcodenum === bsv.Opcode.OP_EQUALVERIFY &&
            script.chunks[4].opcodenum === bsv.Opcode.OP_CHECKSIG &&
            script.chunks[5].opcodenum === bsv.Opcode.OP_0 &&
            script.chunks[6].opcodenum === bsv.Opcode.OP_IF &&
            script.chunks[7].buf &&
            script.chunks[7].buf.length === 3 &&
            script.chunks[7].buf.toString('hex') === '6f7264' &&
            script.chunks[8].opcodenum === bsv.Opcode.OP_1 &&
            script.chunks[9].buf &&
            script.chunks[10].opcodenum === bsv.Opcode.OP_0 &&
            script.chunks[11].buf &&
            script.chunks[12].opcodenum === bsv.Opcode.OP_ENDIF
        )
    }

    static isOrdinalP2PKHV2(script: bsv.Script): boolean {
        return (
            script.chunks.length === 13 &&
            script.chunks[0].opcodenum === bsv.Opcode.OP_0 &&
            script.chunks[1].opcodenum === bsv.Opcode.OP_IF &&
            script.chunks[2].buf &&
            script.chunks[2].buf.length === 3 &&
            script.chunks[2].buf.toString('hex') === '6f7264' &&
            script.chunks[3].opcodenum === bsv.Opcode.OP_1 &&
            script.chunks[4].buf &&
            script.chunks[5].opcodenum === bsv.Opcode.OP_0 &&
            script.chunks[6].buf &&
            script.chunks[7].opcodenum === bsv.Opcode.OP_ENDIF &&
            script.chunks[8].opcodenum === bsv.Opcode.OP_DUP &&
            script.chunks[9].opcodenum === bsv.Opcode.OP_HASH160 &&
            script.chunks[10].buf &&
            script.chunks[10].buf.length === 20 &&
            script.chunks[11].opcodenum === bsv.Opcode.OP_EQUALVERIFY &&
            script.chunks[12].opcodenum === bsv.Opcode.OP_CHECKSIG
        )
    }

    static isOrdinalP2PKH(script: bsv.Script): boolean {
        return (
            Ordinal.isOrdinalP2PKHV1(script) || Ordinal.isOrdinalP2PKHV2(script)
        )
    }

    static getBsv20Json(content: string, contentType): BSV20Protocol {
        if (contentType !== 'application/bsv-20') {
            throw new Error(`invalid bsv20 contentType: ${contentType}`)
        }

        const bsv20 = JSON.parse(content)

        if (
            typeof bsv20.tick === 'string' &&
            typeof bsv20.op === 'string' &&
            typeof bsv20.amt === 'string'
        ) {
            return bsv20
        }

        throw new Error(`invalid bsv20 op, ${content}`)
    }

    static getBsv20(script: bsv.Script): BSV20Protocol {
        if (Ordinal.isOrdinalContract(script)) {
            const content = fromByteString(toHex(script.chunks[6].buf))
            const contentType = fromByteString(toHex(script.chunks[4].buf))
            return Ordinal.getBsv20Json(content, contentType)
        }

        if (Ordinal.isOrdinalP2PKH(script)) {
            if (Ordinal.isOrdinalP2PKHV1(script)) {
                const content = fromByteString(toHex(script.chunks[11].buf))
                const contentType = fromByteString(toHex(script.chunks[9].buf))
                return Ordinal.getBsv20Json(content, contentType)
            } else {
                const content = fromByteString(toHex(script.chunks[6].buf))
                const contentType = fromByteString(toHex(script.chunks[4].buf))
                return Ordinal.getBsv20Json(content, contentType)
            }
        }
        throw new Error(`invalid 1sat ordinal`)
    }

    static getAmt(script: bsv.Script, tick?: string): bigint {
        const bsv20 = Ordinal.getBsv20(script)
        if (typeof tick === 'string' && bsv20.tick !== tick) {
            throw new Error(`invalid bsv20 tick, expected ${tick}`)
        }

        if (bsv20.op === 'mint' || bsv20.op === 'transfer') {
            return BigInt(bsv20.amt)
        }

        throw new Error(`invalid bsv20 op: ${bsv20.op}`)
    }

    static getTick(script: bsv.Script): string {
        const bsv20 = Ordinal.getBsv20(script)

        if (bsv20.op === 'mint' || bsv20.op === 'transfer') {
            return bsv20.tick
        }

        throw new Error(`invalid bsv20 op: ${bsv20.op}`)
    }

    static getInsciption(nopScript: bsv.Script): Inscription {
        const content = fromByteString(toHex(nopScript.chunks[6].buf))
        const contentType = fromByteString(toHex(nopScript.chunks[4].buf))
        return {
            content,
            contentType,
        }
    }
}
