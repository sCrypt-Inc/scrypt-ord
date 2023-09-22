import { MethodCallOptions, SmartContract, bsv } from 'scrypt-ts'

/** Ordinal Inscription */
export type Inscription = {
    /** content in text */
    content: string
    /** contentType in text */
    contentType: string
}

export type BSV20Protocol = {
    op: string
    tick: string
    amt: string
}

export type FTReceiver = {
    instance: SmartContract
    amt: bigint
}

export type NFTReceiver = SmartContract

export interface ORDMethodCallOptions<T> extends MethodCallOptions<T> {
    transfer: Array<FTReceiver> | FTReceiver | NFTReceiver
    tokenChangeAddress?: bsv.Address
    skipTokenChange?: boolean
}
