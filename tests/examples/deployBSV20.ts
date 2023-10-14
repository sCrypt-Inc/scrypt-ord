import {
    bsv,
    TestWallet,
    toByteString,
    Addr,
    MethodCallOptions,
} from 'scrypt-ts'
import { myAddress, myPrivateKey } from '../utils/privateKey'
import { BSV20V1P2PKH, OrdiProvider } from '../scrypt-ord'
import { HashLockFT } from '../contracts/hashLockFT'
/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(myPrivateKey, new OrdiProvider())
}

async function main() {
    HashLockFT.loadArtifact('tests/artifacts/contracts/hashLockFT.json')

    const tick = toByteString('KKK1', true)
    const max = 21000000n
    const lim = 21000000n
    const dec = 0n

    const signer = getSigner()
    const message = toByteString('Hello sCrypt', true)

    await signer.connect()

    const mintTx = await signer.provider?.getTransaction(
        '28d249bc839a44585891148292635753e620fd68e71cd2939a2dd5188ca2c9ae'
    )

    const hashLock = HashLockFT.fromTx(mintTx as bsv.Transaction, 0)

    await hashLock.connect(signer)

    const receiver = {
        instance: new BSV20V1P2PKH(
            tick,
            max,
            lim,
            dec,
            Addr(myAddress.toByteString())
        ),
        amt: hashLock.getAmt(),
    }

    const { tx } = await hashLock.methods.unlock(message, {
        transfer: receiver,
    } as MethodCallOptions<HashLockFT>)

    console.log(`Transfer tx: ${tx.id}`)
}

main()
