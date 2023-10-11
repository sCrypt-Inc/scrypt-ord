import { TestWallet } from 'scrypt-ts'
import { myPrivateKey } from '../utils/privateKey'
import { BSV20V1P2PKH, OrdProvider } from '../scrypt-ord'

/**
 * @returns mainnet signer
 */
function getSigner() {
    return new TestWallet(myPrivateKey, new OrdProvider())
}

async function main() {
    // BSV20 fields
    // const tick = toByteString('VIVO', true)
    // const max = 21000000n
    // const lim = 1337n
    // const dec = 0n

    const signer = getSigner()

    await signer.connect()

    const address = await signer.getDefaultAddress()

    const p2pkhs = await BSV20V1P2PKH.getBSV20('VIVO', address.toString())

    const { tx } = await BSV20V1P2PKH.transfer(p2pkhs, signer, [])

    console.log(`Transfer tx: ${tx.id}`)
}

main()
