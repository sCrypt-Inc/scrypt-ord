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
import { HashPuzzleNFT } from '../contracts/hashPuzzleNFT'
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
    HashPuzzleNFT.loadArtifact('./artifacts/contracts/hashPuzzleNFT.json')

    // create contract instance
    const message = toByteString('Hello sCrypt', true)
    const hash = sha256(message)
    const hashPuzzle = new HashPuzzleNFT(hash)
    await hashPuzzle.connect(getSigner())

    // read image data
    const image = readImage()

    // inscribe image into contract instance
    const mintTx = await hashPuzzle.inscribeImage(image, ContentType.PNG)
    console.log(`Mint tx: ${mintTx.id}`)

    const inscription = hashPuzzle.getInscription().content as Buffer

    writeFileSync('inscription.png', inscription)

    // for now, the contract instance holds the image inscription
    // this inscription can be transferred only when the hash puzzle is solved
    const address = myAddress
    const receiver = new OrdNFTP2PKH(Addr(address.toByteString()))

    const { tx: transferTx } = await hashPuzzle.methods.unlock(message, {
        transfer: receiver,
    } as MethodCallOptions<HashPuzzleNFT>)
    console.log(`Transfer tx: ${transferTx.id}`)
}

main()
