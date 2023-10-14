import { readFileSync, writeFileSync } from 'fs'
import {
    TestWallet,
    toByteString,
    sha256,
    Addr,
    MethodCallOptions,
} from 'scrypt-ts'
import { myAddress, myPrivateKey } from '../utils/privateKey'
import { join } from 'path'
import { HashLockNFT } from '../contracts/hashLockNFT'
import { ContentType, OrdNFTP2PKH, OrdProvider } from '../scrypt-ord'

/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(myPrivateKey, new OrdProvider())
}

/**
 * @returns base64 encoded image binary data
 */
function readImage(): string {
    const path = join(__dirname, '..', '..', 'logo.png')
    return readFileSync(path).toString('base64')
}

async function main() {
    HashLockNFT.loadArtifact('tests/artifacts/contracts/hashLockNFT.json')

    // create contract instance
    const message = toByteString('Hello sCrypt', true)
    const hash = sha256(message)
    const hashLock = new HashLockNFT(hash)
    await hashLock.connect(getSigner())

    // read image data
    const image = readImage()

    // inscribe image into contract instance
    const mintTx = await hashLock.inscribeImage(image, ContentType.PNG)
    console.log(`Mint tx: ${mintTx.id}`)

    const inscription = hashLock.getInscription().content as Buffer

    writeFileSync('inscription.png', inscription)

    // for now, the contract instance holds the image inscription
    // this inscription can be transferred only when the hash lock is solved
    const address = myAddress
    const receiver = new OrdNFTP2PKH(Addr(address.toByteString()))

    const { tx: transferTx } = await hashLock.methods.unlock(message, {
        transfer: receiver,
    } as MethodCallOptions<HashLockNFT>)
    console.log(`Transfer tx: ${transferTx.id}`)
}

main()
