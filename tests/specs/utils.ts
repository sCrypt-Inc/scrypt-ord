import { bsv } from 'scrypt-ts'
import { Ordinal } from '../scrypt-ord'
import { randomBytes } from 'crypto'

export function dummyAppendbsv20(addr: bsv.Address, tick: string, amt: bigint) {
    return {
        script: bsv.Script.buildPublicKeyHashOut(addr)
            .add(Ordinal.createTransfer(tick, amt))
            .toHex(),
        satoshis: 1,
        txId: randomBytes(32).toString('hex'),
        outputIndex: 0,
    }
}

export function dummyPrependbsv20(
    addr: bsv.Address,
    tick: string,
    amt: bigint
) {
    return {
        script: Ordinal.createTransfer(tick, amt)
            .add(bsv.Script.buildPublicKeyHashOut(addr))
            .toHex(),
        satoshis: 1,
        txId: randomBytes(32).toString('hex'),
        outputIndex: 0,
    }
}

export function dummyPrependNFT(addr: bsv.Address, text: string) {
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

export function dummyAppendNFT(addr: bsv.Address, text: string) {
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
