import { MethodCallOptions, SmartContract, bsv } from 'scrypt-ts'

/** Ordinal Inscription */
export type Inscription = {
    /** content in utf8 text or Buffer */
    content: string | Buffer
    /** contentType in text */
    contentType: string
}

export type BSV20_DEPLOY_JSON = {
    p: 'bsv-20'
    op: 'deploy'
    tick: string
    max: string
    lim?: string
    dec?: string
}

export type BSV20_MINT_JSON = {
    p: 'bsv-20'
    op: 'mint'
    tick: string
    amt: string
}

export type BSV20_TRANSFER_JSON = {
    p: 'bsv-20'
    op: 'transfer'
    tick: string
    amt: string
}

export type BSV20_JSON =
    | BSV20_DEPLOY_JSON
    | BSV20_MINT_JSON
    | BSV20_TRANSFER_JSON

export type BSV21_DEPLOY_MINT_JSON = {
    p: 'bsv-20'
    op: 'deploy+mint'
    amt: string
    dec?: string
}

export type BSV21_TRANSFER_JSON = {
    p: 'bsv-20'
    op: 'transfer'
    id: string
    amt: string
}

export type BSV21_JSON = BSV21_DEPLOY_MINT_JSON | BSV21_TRANSFER_JSON

export type FT_JSON = BSV20_JSON | BSV21_JSON

export interface FTReceiver {
    instance: SmartContract
    amt: bigint
}

export type NFTReceiver = SmartContract

export interface OrdiMethodCallOptions<T extends SmartContract>
    extends MethodCallOptions<T> {
    transfer?: Array<FTReceiver> | FTReceiver | NFTReceiver
    tokenChangeAddress?: bsv.Address
    skipTokenChange?: boolean
}
