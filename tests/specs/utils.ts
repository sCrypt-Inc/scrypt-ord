import { bsv } from 'scrypt-ts'
import { ContentType, Ordinal } from '../scrypt-ord'
import { randomBytes } from 'crypto'

/**
 * generate a dummy utxo contains a bsv20 transfer inscription
 * @param addr
 * @param tick
 * @param amt
 * @param prepend put bsv20 inscription at the front of the locking script if true
 * @returns
 */
export function dummyBSV20(
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

/**
 * generate a dummy utxo contains a bsv21 transfer inscription
 * @param addr
 * @param id
 * @param amt
 * @param prepend put bsv20 inscription at the front of the locking script if true
 * @returns
 */
export function dummyBSV21(
    addr: bsv.Address,
    id: string,
    amt: bigint,
    prepend: boolean = true
) {
    if (prepend) {
        return {
            script: Ordinal.createTransferV2(id, amt)
                .add(bsv.Script.buildPublicKeyHashOut(addr))
                .toHex(),
            satoshis: 1,
            txId: randomBytes(32).toString('hex'),
            outputIndex: 0,
        }
    }
    return {
        script: bsv.Script.buildPublicKeyHashOut(addr)
            .add(Ordinal.createTransferV2(id, amt))
            .toHex(),
        satoshis: 1,
        txId: randomBytes(32).toString('hex'),
        outputIndex: 0,
    }
}
/**
 * generate a dummy utxo contains a text inscription
 * @param addr
 * @param text
 * @param prepend put text inscription at the front of the locking script if true
 * @returns
 */
export function dummyNFT(
    addr: bsv.Address,
    text: string,
    prepend: boolean = true
) {
    if (prepend) {
        return {
            script: Ordinal.create({
                content: text,
                contentType: ContentType.TEXT,
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
                    contentType: ContentType.TEXT,
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
