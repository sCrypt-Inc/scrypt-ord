import { bsv } from 'scrypt-ts'
import { Ordinal } from '../scrypt-ord'
import { randomBytes } from 'crypto'

export function dummybsv20V1(addr: bsv.Address, tick: string, amt: bigint) {
    return {
        script: bsv.Script.buildPublicKeyHashOut(addr)
            .add(Ordinal.createTransfer(tick, amt))
            .toHex(),
        satoshis: 1,
        txId: randomBytes(32).toString('hex'),
        outputIndex: 0,
    }
}

export function dummybsv20V2(addr: bsv.Address, tick: string, amt: bigint) {
    return {
        script: Ordinal.createTransfer(tick, amt)
            .add(bsv.Script.buildPublicKeyHashOut(addr))
            .toHex(),
        satoshis: 1,
        txId: randomBytes(32).toString('hex'),
        outputIndex: 0,
    }
}
