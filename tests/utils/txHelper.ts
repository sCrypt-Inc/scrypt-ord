import { DummyProvider, TestWallet, bsv } from 'scrypt-ts'
import { myPrivateKey } from './privateKey'

import * as dotenv from 'dotenv'
import { OrdProvider } from '../scrypt-ord'

// Load the .env file
dotenv.config()

const wallets: Record<string, TestWallet> = {
    testnet: new TestWallet(
        myPrivateKey,
        new OrdProvider(bsv.Networks.testnet)
    ),
    local: new TestWallet(myPrivateKey, new DummyProvider()),
    mainnet: new TestWallet(
        myPrivateKey,
        new OrdProvider(bsv.Networks.mainnet)
    ),
}
export function getDefaultSigner(
    privateKey?: bsv.PrivateKey | bsv.PrivateKey[]
): TestWallet {
    const network = process.env.NETWORK || 'local'

    const wallet = wallets[network]

    if (privateKey) {
        wallet.addPrivateKey(privateKey)
    }

    return wallet
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
