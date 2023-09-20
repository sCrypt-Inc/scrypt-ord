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
