import { readFileSync } from 'fs'
import {
    bsv,
    TestWallet,
    DefaultProvider,
    Addr,
    MethodCallOptions,
    findSig,
    PubKey,
} from 'scrypt-ts'
import { myAddress, myPrivateKey, myPublicKey } from '../utils/privateKey'
import { join } from 'path'
import { ContentType, OrdNFTP2PKH } from '../scrypt-ord'

/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(
        myPrivateKey,
        new DefaultProvider({
            network: bsv.Networks.mainnet,
        })
    )
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

    const p2pkh = new OrdNFTP2PKH(Addr(address.toByteString()))
    await p2pkh.connect(getSigner())

    // read image data
    const image = readImage()

    // inscribe image into contract instance
    const mintTx = await p2pkh.inscribeImage(image, ContentType.PNG)
    console.log(`Mint tx: ${mintTx.id}`)

    // for now, the contract instance holds the image inscription
    // this inscription can be transferred only when the hash puzzle is solved

    const receiver = new OrdNFTP2PKH(Addr(address.toByteString()))

    const { tx: transferTx } = await p2pkh.methods.unlock(
        (sigResponses) => findSig(sigResponses, myPublicKey),
        PubKey(myPublicKey.toByteString()),
        {
            transfer: receiver,
            pubKeyOrAddrToSign: myPublicKey,
        } as MethodCallOptions<OrdNFTP2PKH>
    )
    console.log(`Transfer tx: ${transferTx.id}`)
}

main()
