import { TestWallet, toByteString, sha256, Addr } from 'scrypt-ts'
import { myAddress, myPrivateKey } from '../utils/privateKey'
import { HashLockFTV2 } from '../contracts/hashLockFTV2'
import {
    BSV20V2P2PKH,
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
    HashLockFTV2.loadArtifact('tests/artifacts/contracts/hashLockFTV2.json')

    // BSV20 fields
    const max = 10n
    const dec = 0n

    // create contract instance
    const message = toByteString('Hello sCrypt', true)
    const hash = sha256(message)
    const hashLock = new HashLockFTV2(toByteString(''), max, dec, hash)
    await hashLock.connect(getSigner())

    // deploy the new BSV20V2 token
    const tokenId = await hashLock.deployToken()
    console.log(`tokenId: ${tokenId}`)

    // for now, the contract instance holds the BSV20V2 token
    // this token can be transferred only when the hash lock is solved
    const addressAlice = Addr(myAddress.toByteString())
    const alice = new BSV20V2P2PKH(
        toByteString(tokenId, true),
        max,
        dec,
        addressAlice
    )
    const addressBob = Addr(myAddress.toByteString())
    const bob = new BSV20V2P2PKH(
        toByteString(tokenId, true),
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
