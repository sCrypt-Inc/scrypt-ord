import {
    TestWallet,
    toByteString,
    Addr,
    findSig,
    OrdiMethodCallOptions,
    PubKey,
} from 'scrypt-ts'
import { myPrivateKey, myPublicKey } from '../utils/privateKey'
import { BSV20V2P2PKH, OrdiProvider } from '../scrypt-ord'

/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(myPrivateKey, new OrdiProvider())
}

async function main() {
    const signer = getSigner()

    await signer.connect()
    const address = await signer.getDefaultAddress()
    const p2pkh = new BSV20V2P2PKH(
        toByteString(''),
        10000000n,
        0n,
        Addr(address.toByteString())
    )
    await p2pkh.connect(signer)
    const tokenId = await p2pkh.deployToken()
    console.log(`tokenId: ${tokenId}`)
    // const p2pkhs = await BSV20V2P2PKH.getBSV20(tokenId, address.toString())
    // const {tx} = await BSV20V2P2PKH.transfer(p2pkhs, signer, [])

    const { tx } = await p2pkh.methods.unlock(
        (sigResponses) => findSig(sigResponses, myPublicKey),
        PubKey(myPublicKey.toByteString()),
        {
            transfer: [],
            pubKeyOrAddrToSign: myPublicKey,
        } as OrdiMethodCallOptions<BSV20V2P2PKH>
    )

    console.log(`Transfer tx: ${tx.id}`)
}

main()
