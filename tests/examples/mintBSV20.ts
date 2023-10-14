import {
    TestWallet,
    toByteString,
    sha256,
    Addr,
    MethodCallOptions,
} from 'scrypt-ts'
import { myAddress, myPrivateKey } from '../utils/privateKey'
import { HashLockFT } from '../contracts/hashLockFT'
import { BSV20V1P2PKH, OrdiProvider } from '../scrypt-ord'

/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(myPrivateKey, new OrdiProvider())
}

async function main() {
    HashLockFT.loadArtifact('tests/artifacts/contracts/hashLockFT.json')

    // BSV20 fields
    const tick = toByteString('HELLO', true)
    const max = 21000000n
    const lim = 1337n
    const dec = 0n

    // create contract instance
    const message = toByteString('Hello sCrypt', true)
    const hash = sha256(message)
    const hashLock = new HashLockFT(tick, max, lim, dec, hash)
    await hashLock.connect(getSigner())

    // deploy the new BSV20 token $HELLO
    // await hashLock.deployToken()
    // mint 10 $HELLO into contract instance
    const mintTx = await hashLock.mint(10n)
    console.log(`Mint tx: ${mintTx.id}`)

    console.log(hashLock.getInscription())

    // for now, the contract instance holds the BSV20 token
    // this token can be transferred only when the hash lock is solved
    const addressAlice = Addr(myAddress.toByteString())
    const alice = new BSV20V1P2PKH(tick, max, lim, dec, addressAlice)
    const addressBob = Addr(myAddress.toByteString())
    const bob = new BSV20V1P2PKH(tick, max, lim, dec, addressBob)

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
    } as MethodCallOptions<HashLockFT>)
    console.log(`Transfer tx: ${transferTx.id}`)
}

main()
