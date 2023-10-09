import {
    bsv,
    TestWallet,
    DefaultProvider,
    toByteString,
    Addr,
    sha256,
    MethodCallOptions,
} from 'scrypt-ts'
import { myAddress, myPrivateKey } from '../utils/privateKey'
import { BSV20V2P2PKH } from '../scrypt-ord'
import { HashPuzzleFTV2 } from '../contracts/hashPuzzleFTV2'
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

async function main() {
    HashPuzzleFTV2.loadArtifact('./artifacts/contracts/hashPuzzleFTV2.json')

    // BSV20 fields
    const max = 21000000n
    const dec = 0n

    const signer = getSigner()

    const message = toByteString('Hello sCrpyt', true)
    const hash = sha256(message)
    const hashPuzzle = new HashPuzzleFTV2(toByteString(''), max, dec, hash)
    await hashPuzzle.connect(signer)
    const tokenId = await hashPuzzle.deployToken()

    console.log(`tokenId: ${tokenId}`)
    const receiver = {
        instance: new BSV20V2P2PKH(
            toByteString(tokenId, true),
            max,
            dec,
            Addr(myAddress.toByteString())
        ),
        amt: hashPuzzle.getAmt(),
    }
    const { tx } = await hashPuzzle.methods.unlock(message, {
        transfer: receiver,
    } as MethodCallOptions<HashPuzzleFTV2>)
    console.log(`Transfer tx: ${tx.id}`)
}

main()
