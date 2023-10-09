import { MethodCallOptions, SmartContract, bsv } from 'scrypt-ts'

/** Ordinal Inscription */
export type Inscription = {
    /** content in utf8 text or Buffer */
    content: string | Buffer
    /** contentType in text */
    contentType: string
}

export type BSV20V1_DEPLOY_JSON = {
    p: 'bsv-20'
    op: 'deploy'
    tick: string
    max: string
    lim?: string
    dec?: string
}

export type BSV20V1_MINT_JSON = {
    p: 'bsv-20'
    op: 'mint'
    tick: string
    amt: string
}

export type BSV20V1_TRANSFER_JSON = {
    p: 'bsv-20'
    op: 'transfer'
    tick: string
    amt: string
}

export type BSV20V1_JSON =
    | BSV20V1_DEPLOY_JSON
    | BSV20V1_MINT_JSON
    | BSV20V1_TRANSFER_JSON

export type BSV20V2_DEPLOY_MINT_JSON = {
    p: 'bsv-20'
    op: 'deploy+mint'
    amt: string
    dec?: string
}

export type BSV20V2_TRANSFER_JSON = {
    p: 'bsv-20'
    op: 'transfer'
    id: string
    amt: string
}

export type BSV20V2_JSON = BSV20V2_DEPLOY_MINT_JSON | BSV20V2_TRANSFER_JSON

export type BSV20_JSON = BSV20V1_JSON | BSV20V2_JSON

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
