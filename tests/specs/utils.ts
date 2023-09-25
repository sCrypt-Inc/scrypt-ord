import { bsv } from 'scrypt-ts'
import { Ordinal } from '../scrypt-ord'
import { randomBytes } from 'crypto'

/**
 * generate a dummy utxo contains a bsv20 inscription
 * @param addr
 * @param tick
 * @param amt
 * @param prepend put bsv20 inscription at the front of the locking script if true
 * @returns
 */
export function dummybsv20(
    addr: bsv.Address,
    tick: string,
    amt: bigint,
    prepend: boolean = true
) {
    if (prepend) {
        return {
            script: Ordinal.createTransfer(tick, amt)
                .add(bsv.Script.buildPublicKeyHashOut(addr))
                .toHex(),
            satoshis: 1,
            txId: randomBytes(32).toString('hex'),
            outputIndex: 0,
        }
    }
    return {
        script: bsv.Script.buildPublicKeyHashOut(addr)
            .add(Ordinal.createTransfer(tick, amt))
            .toHex(),
        satoshis: 1,
        txId: randomBytes(32).toString('hex'),
        outputIndex: 0,
    }
}

export function dummyNFT(
    addr: bsv.Address,
    text: string,
    prepend: boolean = true
) {
    if (prepend) {
        return {
            script: Ordinal.create({
                content: text,
                contentType: 'text/plain',
            })
                .add(bsv.Script.buildPublicKeyHashOut(addr))
                .toHex(),
            satoshis: 1,
            txId: randomBytes(32).toString('hex'),
            outputIndex: 0,
        }
    }
    return {
        script: bsv.Script.buildPublicKeyHashOut(addr)
            .add(
                Ordinal.create({
                    content: text,
                    contentType: 'text/plain',
                })
            )
            .toHex(),
        satoshis: 1,
        txId: randomBytes(32).toString('hex'),
        outputIndex: 0,
    }
}

export function dummyP2PKH(addr: bsv.Address) {
    return {
        script: bsv.Script.buildPublicKeyHashOut(addr).toHex(),
        satoshis: 1,
        txId: randomBytes(32).toString('hex'),
        outputIndex: 0,
    }
}
