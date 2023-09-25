import { expect, use } from 'chai'
import { MethodCallOptions, Addr, PubKey, findSig, toHex } from 'scrypt-ts'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH } from '../scrypt-ord'
import { dummyAppendNFT, dummyPrependNFT, dummyP2PKH } from './utils'
import { CounterNFT } from '../contracts/counterNFT'
import { myAddress, myPublicKey } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test SmartContract send FT to `CounterNFT`', () => {
    before(async () => {
        CounterNFT.loadArtifact()
    })

    async function transferToCounter(p2pkh: OrdP2PKH): Promise<CounterNFT> {
        const counter = new CounterNFT(0n)
        await counter.connect(getDefaultSigner())

        const { tx } = await p2pkh.methods.unlock(
            (sigResps) => findSig(sigResps, myPublicKey),
            PubKey(toHex(myPublicKey)),
            {
                transfer: counter,
                pubKeyOrAddrToSign: myPublicKey,
            } as MethodCallOptions<OrdP2PKH>
        )
        console.log('transfer NFT:', tx.id)
        return counter
    }

    async function counterTransfer(counter: CounterNFT) {
        const { tx } = await counter.methods.withdraw(
            Addr(myAddress.toByteString())
        )
        console.log('transfer NFT: ', tx.id)
    }

    it('P2PKH with inscription appended', async () => {
        const p2pkh = OrdP2PKH.fromP2PKH(
            dummyAppendNFT(myAddress, 'hello world')
        )
        await p2pkh.connect(getDefaultSigner())

        const counter = await transferToCounter(p2pkh)
        await expect(counterTransfer(counter)).not.to.be.rejected
    })

    it('P2PKH with inscription prepended', async () => {
        const p2pkh = OrdP2PKH.fromP2PKH(
            dummyPrependNFT(myAddress, 'hello world')
        )
        await p2pkh.connect(getDefaultSigner())

        const counter = await transferToCounter(p2pkh)
        await expect(counterTransfer(counter)).not.to.be.rejected
    })

    it('P2PKH without inscription', async () => {
        const p2pkh = OrdP2PKH.fromP2PKH(dummyP2PKH(myAddress))
        await p2pkh.connect(getDefaultSigner())

        const counter = await transferToCounter(p2pkh)
        await expect(counterTransfer(counter)).not.to.be.rejected
    })
})
