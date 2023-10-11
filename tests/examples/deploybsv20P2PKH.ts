import {
    TestWallet,
    toByteString,
    Addr,
    MethodCallOptions,
    findSig,
    PubKey,
} from 'scrypt-ts'
import { myAddress, myPrivateKey, myPublicKey } from '../utils/privateKey'
import { BSV20V1P2PKH, OrdProvider } from '../scrypt-ord'
/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(myPrivateKey, new OrdProvider())
}

async function main() {
    const tick = toByteString('KKK1', true)
    const max = 21000000n
    const lim = 21000000n
    const dec = 0n

    const signer = getSigner()

    const p2pkh = new BSV20V1P2PKH(
        tick,
        max,
        lim,
        dec,
        Addr(myAddress.toByteString())
    )
    await p2pkh.connect(signer)

    const mintTx = await p2pkh.mint(1111n)

    console.log(`mint: ${mintTx.id}`)

    const receiver = {
        instance: new BSV20V1P2PKH(
            tick,
            max,
            lim,
            dec,
            Addr(myAddress.toByteString())
        ),
        amt: p2pkh.getAmt(),
    }

    const { tx: transferTx } = await p2pkh.methods.unlock(
        (sigResponses) => findSig(sigResponses, myPublicKey),
        PubKey(myPublicKey.toByteString()),
        {
            transfer: receiver,
            pubKeyOrAddrToSign: myPublicKey,
        } as MethodCallOptions<BSV20V1P2PKH>
    )

    console.log(`Transfer tx: ${transferTx.id}`)
}

main()
