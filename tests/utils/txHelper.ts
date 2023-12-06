import { DummyProvider, Provider, TestWallet, bsv } from 'scrypt-ts'
import { myPrivateKey } from './privateKey'

import * as dotenv from 'dotenv'
import { OrdiProvider } from '../scrypt-ord'

// Load the .env file
dotenv.config()

const privders: Record<string, Provider> = {
    testnet: new OrdiProvider(bsv.Networks.testnet),
    local: new DummyProvider(),
    mainnet: new OrdiProvider(bsv.Networks.mainnet),
}
export function getDefaultSigner(
    privateKey?: bsv.PrivateKey | bsv.PrivateKey[]
): TestWallet {
    const network = process.env.NETWORK || 'local'
    const privder = privders[network]
    return new TestWallet(privateKey || myPrivateKey, privder)
}

export const sleep = async (seconds: number) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({})
        }, seconds * 1000)
    })
}

export function randomPrivateKey() {
    const privateKey = bsv.PrivateKey.fromRandom(bsv.Networks.testnet)
    const publicKey = bsv.PublicKey.fromPrivateKey(privateKey)
    const publicKeyHash = bsv.crypto.Hash.sha256ripemd160(publicKey.toBuffer())
    const address = publicKey.toAddress()
    return [privateKey, publicKey, publicKeyHash, address] as const
}
