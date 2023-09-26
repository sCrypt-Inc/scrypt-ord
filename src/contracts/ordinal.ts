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
    bsv,
    toHex,
} from 'scrypt-ts'
import { Shift10 } from 'scrypt-ts-lib'
import {
    BSV20V1_JSON,
    BSV20V2_JSON,
    BSV20V2_TRANSFER_JSON,
    BSV20_JSON,
    Inscription,
} from '../types'
import { fromByteString } from '../utils'
import { ContentType } from '../contentType'

export class Ordinal extends SmartContractLib {
    @method()
    static skipBytes(b: ByteString): bigint {
        let len = 0n
        let ret = 0n
        const header: bigint = byteString2Int(slice(b, 0n, 1n))

        if (header < 0x4cn) {
            // Opcodes 1-75 simply push their value of bytes of data onto the stack
            len = header
            ret = 1n + len
        } else if (header == 0x4cn) {
            // OP_PUSHDATA1 takes the next 1 byte as the number of bytes to push onto the stack
            len = Utils.fromLEUnsigned(slice(b, 1n, 2n))
            ret = 1n + 1n + len
        } else if (header == 0x4dn) {
            // OP_PUSHDATA2 takes the next 2 bytes as the number of bytes to push onto the stack
            len = Utils.fromLEUnsigned(slice(b, 1n, 3n))
            ret = 1n + 2n + len
        } else if (header == 0x4en) {
            // OP_PUSHDATA4 takes the next 4 bytes as the number of bytes to push onto the stack
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
        // P2PKH locking script (25 bytes) + Inscription
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
            // OP_FALSE OP_IF "ord" OP_1
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

    @method()
    static txId2str(txid: ByteString): ByteString {
        let txidStr = toByteString('')
        const ascii = toByteString('0123456789abcdef', true)
        for (let i = 0n; i < 32n; i++) {
            const index = 32n - i - 1n
            const char = slice(txid, index, index + 1n)
            const cInt = Utils.fromLEUnsigned(char)
            const left = cInt / 16n
            const right = cInt % 16n
            txidStr += slice(ascii, left, left + 1n)
            txidStr += slice(ascii, right, right + 1n)
        }

        return txidStr
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
        if (n == 0n) {
            res = toByteString('30')
        }

        return res
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
            contentType: ContentType.BSV20,
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
            contentType: ContentType.BSV20,
        })
    }

    static createDeploy(
        tick: string,
        max: bigint,
        lim: bigint,
        dec: bigint
    ): bsv.Script {
        return Ordinal.create({
            content: JSON.stringify({
                p: 'bsv-20',
                op: 'deploy',
                tick,
                max: max.toString().replace(/n/, ''),
                lim: lim.toString().replace(/n/, ''),
                dec: dec.toString().replace(/n/, ''),
            }),
            contentType: ContentType.BSV20,
        })
    }

    static createDeployV2(amt: bigint, dec: bigint): bsv.Script {
        return Ordinal.create({
            content: JSON.stringify({
                p: 'bsv-20',
                op: 'deploy+mint',
                amt: amt.toString().replace(/n/, ''),
                dec: dec.toString().replace(/n/, ''),
            }),
            contentType: 'application/bsv-20',
        })
    }

    static createTransferV2(id: string, amt: bigint): bsv.Script {
        return Ordinal.create({
            content: JSON.stringify({
                p: 'bsv-20',
                op: 'transfer',
                id,
                amt: amt.toString().replace(/n/, ''),
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
        // P2PKH locking script + inscription
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
        // inscription + P2PKH locking script
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

    static getBsv20v1Json(content: string, contentType: string): BSV20V1_JSON {
        if (contentType !== ContentType.BSV20) {
            throw new Error(`invalid bsv20 contentType: ${contentType}`)
        }
        const bsv20P = 'bsv-20'

        const bsv20 = JSON.parse(content)

        if (
            bsv20.p === bsv20P &&
            bsv20.op === 'deploy' &&
            typeof bsv20.tick === 'string' &&
            typeof bsv20.max === 'string'
        ) {
            // BSV20V1_DEPLOY_JSON
            return bsv20
        } else if (
            bsv20.p === bsv20P &&
            bsv20.op === 'mint' &&
            typeof bsv20.tick === 'string' &&
            typeof bsv20.amt === 'string'
        ) {
            // BSV20V1_MINT_JSON
            return bsv20
        } else if (
            bsv20.p === bsv20P &&
            bsv20.op === 'transfer' &&
            typeof bsv20.tick === 'string' &&
            typeof bsv20.amt === 'string'
        ) {
            // BSV20V1_TRANSFER_JSON
            return bsv20
        }

        throw new Error(`invalid bsv20 v1 json, ${content}`)
    }

    static getBsv20v2Json(content: string, contentType: string): BSV20V1_JSON {
        if (contentType !== 'application/bsv-20') {
            throw new Error(`invalid bsv20 contentType: ${contentType}`)
        }

        const bsv20 = JSON.parse(content)
        const bsv20P = 'bsv-20'

        if (
            bsv20.p === bsv20P &&
            bsv20.op === 'deploy+mint' &&
            typeof bsv20.amt === 'string'
        ) {
            // BSV20V2_DEPLOY_MINT_JSON
            return bsv20
        } else if (
            bsv20.p === bsv20P &&
            bsv20.op === 'transfer' &&
            typeof bsv20.id === 'string' &&
            typeof bsv20.amt === 'string'
        ) {
            // BSV20V2_TRANSFER_JSON
            return bsv20
        }

        throw new Error(`invalid bsv20 v2 json, ${content}`)
    }

    static getBsv20(script: bsv.Script, v1: boolean): BSV20_JSON {
        const [content, contentType] = Ordinal.isOrdinalContract(script)
            ? [
                  fromByteString(toHex(script.chunks[6].buf)),
                  fromByteString(toHex(script.chunks[4].buf)),
              ]
            : Ordinal.isOrdinalP2PKHV1(script)
            ? [
                  fromByteString(toHex(script.chunks[11].buf)),
                  fromByteString(toHex(script.chunks[9].buf)),
              ]
            : [
                  fromByteString(toHex(script.chunks[6].buf)),
                  fromByteString(toHex(script.chunks[4].buf)),
              ]

        return v1
            ? Ordinal.getBsv20v1Json(content, contentType)
            : Ordinal.getBsv20v2Json(content, contentType)
    }

    static getAmt(script: bsv.Script, tick?: string): bigint {
        const bsv20 = Ordinal.getBsv20(script, true) as BSV20V1_JSON
        if (typeof tick === 'string' && bsv20.tick !== tick) {
            throw new Error(`invalid bsv20 tick, expected ${tick}`)
        }

        if (bsv20.op === 'mint' || bsv20.op === 'transfer') {
            return BigInt(bsv20.amt)
        }

        throw new Error(`invalid bsv20 op: ${bsv20.op}`)
    }

    static getAmtV2(script: bsv.Script): bigint {
        const bsv20 = Ordinal.getBsv20(script, false) as BSV20V2_JSON
        return BigInt(bsv20.amt)
    }

    static getTokenId(script: bsv.Script): string {
        const bsv20 = Ordinal.getBsv20(script, false) as BSV20V2_TRANSFER_JSON
        return bsv20.id
    }

    static getTick(script: bsv.Script): string {
        const bsv20 = Ordinal.getBsv20(script, true) as BSV20V1_JSON

        if (bsv20.op === 'mint' || bsv20.op === 'transfer') {
            return bsv20.tick
        }

        throw new Error(`invalid bsv20 op: ${bsv20.op}`)
    }

    static getInscription(nopScript: bsv.Script): Inscription {
        const content = fromByteString(toHex(nopScript.chunks[6].buf))
        const contentType = fromByteString(toHex(nopScript.chunks[4].buf))
        return {
            content,
            contentType,
        }
    }

    static nopScriptFromScript(script: bsv.Script): bsv.Script {
        return bsv.Script.fromHex(Ordinal.getInsciptionScript(script.toHex()))
    }
}
