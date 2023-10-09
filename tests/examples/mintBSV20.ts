import {
    bsv,
    TestWallet,
    DefaultProvider,
    toByteString,
    sha256,
    Addr,
    MethodCallOptions,
} from 'scrypt-ts'
import { myAddress, myPrivateKey } from '../utils/privateKey'
import { HashPuzzleFT } from '../contracts/hashPuzzleFT'
import { BSV20V1P2PKH } from '../scrypt-ord'

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
    HashPuzzleFT.loadArtifact('./artifacts/contracts/hashPuzzleFT.json')

    // BSV20 fields
    const tick = toByteString('HELLO', true)
    const max = 100n
    const lim = 10n
    const dec = 0n

    // create contract instance
    const message = toByteString('Hello sCrpyt', true)
    const hash = sha256(message)
    const hashPuzzle = new HashPuzzleFT(tick, max, lim, dec, hash)
    await hashPuzzle.connect(getSigner())

    // deploy the new BSV20 token $HELLO
    await hashPuzzle.deployToken()
    // mint 10 $HELLO into contract instance
    const mintTx = await hashPuzzle.mint(10n)
    console.log(`Mint tx: ${mintTx.id}`)

    console.log(hashPuzzle.getInscription())

    // for now, the contract instance holds the BSV20 token
    // this token can be transferred only when the hash puzzle is solved
    const addressAlice = Addr(myAddress.toByteString())
    const alice = new BSV20V1P2PKH(tick, max, lim, dec, addressAlice)
    const addressBob = Addr(myAddress.toByteString())
    const bob = new BSV20V1P2PKH(tick, max, lim, dec, addressBob)

    const { tx: transferTx } = await hashPuzzle.methods.unlock(message, {
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
    } as MethodCallOptions<HashPuzzleFT>)
    console.log(`Transfer tx: ${transferTx.id}`)
}

main()
