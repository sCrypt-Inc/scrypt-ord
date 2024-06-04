import { TestWallet, toByteString, Addr, sha256 } from 'scrypt-ts'
import { myAddress, myPrivateKey } from '../utils/privateKey'
import {
    BSV21P2PKH,
    OrdiProvider,
    OrdiMethodCallOptions,
} from '../scrypt-ord'
import { HashLockFTV2 } from '../contracts/hashLockFTV2'
/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(myPrivateKey, new OrdiProvider())
}

async function main() {
    HashLockFTV2.loadArtifact('tests/artifacts/contracts/hashLockFTV2.json')

    // BSV20 fields
    const max = 21000000n
    const dec = 0n
    const sym = toByteString('MEME', true)

    const signer = getSigner()

    const message = toByteString('Hello sCrypt', true)
    const hash = sha256(message)
    const hashLock = new HashLockFTV2(toByteString(''), sym, max, dec, hash)
    await hashLock.connect(signer)
    const tokenId = await hashLock.deployToken()

    console.log(`tokenId: ${tokenId}`)
    const receiver = {
        instance: new BSV21P2PKH(
            toByteString(tokenId, true),
            sym,
            max,
            dec,
            Addr(myAddress.toByteString())
        ),
        amt: hashLock.getAmt(),
    }
    const { tx } = await hashLock.methods.unlock(message, {
        transfer: receiver,
    } as OrdiMethodCallOptions<HashLockFTV2>)
    console.log(`Transfer tx: ${tx.id}`)
}

main()
