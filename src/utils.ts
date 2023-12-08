import { ByteString } from 'scrypt-ts'

/**
 * convert ByteString to utf8 string
 * @param bs ByteString
 * @returns utf8 string
 */
export function fromByteString(bs: ByteString): string {
    const encoder = new TextDecoder()
    return encoder.decode(Buffer.from(bs, 'hex'))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handlerApiError(e: Error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = (e as unknown as any).response?.body?.message || e.message
    throw new Error(message)
}

export function isBSV20v2(tick: string) {
    return /^[a-fA-F0-9]{64}_\d+$/.test(tick)
}
