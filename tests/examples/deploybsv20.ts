import {
    bsv,
    TestWallet,
    DefaultProvider,
    toByteString,
    Addr,
    MethodCallOptions,
} from 'scrypt-ts'
import { myAddress, myPrivateKey } from '../utils/privateKey'
import { BSV20V1P2PKH } from '../scrypt-ord'
import { HashPuzzleFT } from '../contracts/hashPuzzleFT'
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

    const tick = toByteString('KKK1', true)
    const max = 21000000n
    const lim = 21000000n
    const dec = 0n

    const signer = getSigner()
    const message = toByteString('Hello sCrpyt', true)
    // const hash = sha256(message)
    // const hashPuzzle = new HashPuzzleFT(
    //     tick,
    //     max,
    //     lim,
    //     dec,
    //     hash
    // )
    // await hashPuzzle.connect(signer);

    // const deployTx = await hashPuzzle.deployToken();

    // console.log(`deploy: ${deployTx.id}`)

    // const mintTx = await hashPuzzle.mint(1000n);

    //    console.log(`mint: ${mintTx.id}`)

    {
        await signer.connect()

        const mintTx = await signer.provider?.getTransaction(
            '28d249bc839a44585891148292635753e620fd68e71cd2939a2dd5188ca2c9ae'
        )

        const hashPuzzle = HashPuzzleFT.fromTx(mintTx as bsv.Transaction, 0)

        await hashPuzzle.connect(signer)

        const receiver = {
            instance: new BSV20V1P2PKH(
                tick,
                max,
                lim,
                dec,
                Addr(myAddress.toByteString())
            ),
            amt: hashPuzzle.getAmt(),
        }

        const { tx } = await hashPuzzle.methods.unlock(message, {
            transfer: receiver,
        } as MethodCallOptions<HashPuzzleFT>)

        console.log(`Transfer tx: ${tx.id}`)
    }
}

main()
