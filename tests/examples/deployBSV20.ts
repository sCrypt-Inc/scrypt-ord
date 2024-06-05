import { bsv, TestWallet, toByteString, Addr } from 'scrypt-ts'
import { myAddress, myPrivateKey } from '../utils/privateKey'
import {
    BSV20P2PKH,
    OrdiProvider,
    OrdiMethodCallOptions,
    FTReceiver,
} from '../scrypt-ord'
import { HashLockBSV20 } from '../contracts/hashLockBSV20'
/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(myPrivateKey, new OrdiProvider())
}

async function main() {
    HashLockBSV20.loadArtifact('tests/artifacts/contracts/hashLockFT.json')

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

    const hashLock = HashLockBSV20.fromTx(mintTx as bsv.Transaction, 0)

    await hashLock.connect(signer)

    const receiver: FTReceiver = {
        instance: new BSV20P2PKH(
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
    } as OrdiMethodCallOptions<HashLockBSV20>)

    console.log(`Transfer tx: ${tx.id}`)
}

main()
