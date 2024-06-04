import { TestWallet, toByteString, sha256, Addr } from 'scrypt-ts'
import { myAddress, myPrivateKey } from '../utils/privateKey'
import { HashLockFTV2 } from '../contracts/hashLockFTV2'
import {
    BSV21P2PKH,
    OrdiProvider,
    OrdiMethodCallOptions,
} from '../scrypt-ord'

/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(myPrivateKey, new OrdiProvider())
}

async function main() {
    HashLockFTV2.loadArtifact('./artifacts/contracts/hashLockFTV2.json')

    // BSV20 fields
    const max = 10000n
    const dec = 0n
    const sym = toByteString('MEME', true)

    // create contract instance
    const message = toByteString('Hello sCrypt', true)
    const hash = sha256(message)
    const hashLock = new HashLockFTV2(toByteString(''), sym, max, dec, hash)
    await hashLock.connect(getSigner())

    // deploy the new BSV21 token
    const tokenId = await hashLock.deployToken({
        name: 'MEME TOKEN',
    })
    console.log(`tokenId: ${tokenId}`)

    // for now, the contract instance holds the BSV21 token
    // this token can be transferred only when the hash lock is solved
    const addressAlice = Addr(myAddress.toByteString())
    const alice = new BSV21P2PKH(
        toByteString(tokenId, true),
        sym,
        max,
        dec,
        addressAlice
    )
    const addressBob = Addr(myAddress.toByteString())
    const bob = new BSV21P2PKH(
        toByteString(tokenId, true),
        sym,
        max,
        dec,
        addressBob
    )

    const { tx: transferTx } = await hashLock.methods.unlock(message, {
        transfer: [
            {
                instance: alice,
                amt: 2n,
            },
            {
                instance: bob,
                amt: 5n,
            },
        ],
    } as OrdiMethodCallOptions<HashLockFTV2>)
    console.log(`Transfer tx: ${transferTx.id}`)
}

main()
