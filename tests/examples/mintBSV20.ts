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
import { BSV20P2PKH } from '../scrypt-ord'

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
    HashPuzzleFT.loadArtifact('tests/artifacts/contracts/hashPuzzleFT.json')

    // BSV20 fields
    const tick = toByteString('HELLO', true)
    const max = 100n
    const lim = 10n

    // create contract instance
    const message = toByteString('Hello sCrpyt', true)
    const hash = sha256(message)
    const hashPuzzle = new HashPuzzleFT(tick, max, lim, hash)
    await hashPuzzle.connect(getSigner())

    // deploy the new BSV20 token $HELLO
    await hashPuzzle.deployToken()
    // mint 10 $HELLO into contract instance
    const mintTx = await hashPuzzle.mint(10n)
    console.log(`Mint tx: ${mintTx.id}`)

    // for now, the contract instance holds the BSV20 token
    // this token can be transferred only when the hash puzzle is solved
    const addressAlice = myAddress
    const alice = new BSV20P2PKH(
        tick,
        max,
        lim,
        Addr(addressAlice.toByteString())
    )
    const addressBob = myAddress
    const bob = new BSV20P2PKH(tick, max, lim, Addr(addressBob.toByteString()))

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
