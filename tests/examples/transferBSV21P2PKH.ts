import { TestWallet, toByteString, Addr, findSig, PubKey } from 'scrypt-ts'
import { myPrivateKey, myPublicKey } from '../utils/privateKey'
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
    const signer = getSigner()
    const sym = toByteString('MEME', true)

    await signer.connect()
    const address = await signer.getDefaultAddress()
    const p2pkh = new BSV21P2PKH(
        toByteString(''),
        sym,
        10000000n,
        0n,
        Addr(address.toByteString())
    )
    await p2pkh.connect(signer)
    const tokenId = await p2pkh.deployToken()
    console.log(`tokenId: ${tokenId}`)
    // const p2pkhs = await BSV21P2PKH.getBSV20(tokenId, address.toString())
    // const {tx} = await BSV21P2PKH.transfer(p2pkhs, signer, [])

    const { tx } = await p2pkh.methods.unlock(
        (sigResponses) => findSig(sigResponses, myPublicKey),
        PubKey(myPublicKey.toByteString()),
        {
            transfer: [],
            pubKeyOrAddrToSign: myPublicKey,
        } as OrdiMethodCallOptions<BSV21P2PKH>
    )

    console.log(`Transfer tx: ${tx.id}`)
}

main()
