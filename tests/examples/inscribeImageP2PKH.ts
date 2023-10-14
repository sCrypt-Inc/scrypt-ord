import { readFileSync } from 'fs'
import { TestWallet, Addr, MethodCallOptions, findSig, PubKey } from 'scrypt-ts'
import { myAddress, myPrivateKey, myPublicKey } from '../utils/privateKey'
import { join } from 'path'
import { ContentType, OrdiNFTP2PKH, OrdiProvider } from '../scrypt-ord'

/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(myPrivateKey, new OrdiProvider())
}

/**
 * @returns base64 encoded image binary data
 */
function readImage(): string {
    const path = join(__dirname, '..', '..', 'logo.png')
    return readFileSync(path).toString('base64')
}

async function main() {
    const address = myAddress

    const p2pkh = new OrdiNFTP2PKH(Addr(address.toByteString()))
    await p2pkh.connect(getSigner())

    // read image data
    const image = readImage()

    // inscribe image into contract instance
    const mintTx = await p2pkh.inscribeImage(image, ContentType.PNG)
    console.log(`Mint tx: ${mintTx.id}`)

    const receiver = new OrdiNFTP2PKH(Addr(address.toByteString()))

    const { tx: transferTx } = await p2pkh.methods.unlock(
        (sigResponses) => findSig(sigResponses, myPublicKey),
        PubKey(myPublicKey.toByteString()),
        {
            transfer: receiver,
            pubKeyOrAddrToSign: myPublicKey,
        } as MethodCallOptions<OrdiNFTP2PKH>
    )
    console.log(`Transfer tx: ${transferTx.id}`)
}

main()
