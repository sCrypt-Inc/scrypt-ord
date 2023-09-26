import { expect, use } from 'chai'
import {
    MethodCallOptions,
    Addr,
    PubKey,
    findSig,
    toHex,
    toByteString,
} from 'scrypt-ts'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OneSatNFTP2PKH } from '../scrypt-ord'
import { dummyNFT, dummyP2PKH } from './utils'
import { CounterNFT } from '../contracts/counterNFT'
import { myAddress, myPublicKey } from '../utils/privateKey'
use(chaiAsPromised)

describe('Test SmartContract send FT to `CounterNFT`', () => {
    before(async () => {
        CounterNFT.loadArtifact()
    })

    async function transferToCounter(
        p2pkh: OneSatNFTP2PKH
    ): Promise<CounterNFT> {
        const counter = new CounterNFT(0n)
        await counter.connect(getDefaultSigner())

        const { tx } = await p2pkh.methods.unlock(
            (sigResps) => findSig(sigResps, myPublicKey),
            PubKey(myPublicKey.toByteString()),
            {
                transfer: counter,
                pubKeyOrAddrToSign: myPublicKey,
            } as MethodCallOptions<OneSatNFTP2PKH>
        )
        console.log('transfer NFT:', tx.id)
        return counter
    }

    async function counterTransfer(counter: CounterNFT) {
        const p2pkh = new OneSatNFTP2PKH(Addr(myAddress.toByteString()))
        const { tx } = await counter.methods.withdraw(
            toByteString(p2pkh.lockingScript.toHex())
        )
        console.log('transfer NFT: ', tx.id)
    }

    it('P2PKH with inscription appended', async () => {
        // put text inscription at the end of the locking script
        const p2pkh = OneSatNFTP2PKH.fromUTXO(
            dummyNFT(myAddress, 'hello world', false)
        )
        await p2pkh.connect(getDefaultSigner())

        const counter = await transferToCounter(p2pkh)
        await expect(counterTransfer(counter)).not.to.be.rejected
    })

    it('P2PKH with inscription prepended', async () => {
        // put text inscription at the start of the locking script
        const p2pkh = OneSatNFTP2PKH.fromUTXO(
            dummyNFT(myAddress, 'hello world')
        )
        await p2pkh.connect(getDefaultSigner())

        const counter = await transferToCounter(p2pkh)
        await expect(counterTransfer(counter)).not.to.be.rejected
    })

    it('P2PKH without inscription', async () => {
        const p2pkh = OneSatNFTP2PKH.fromUTXO(dummyP2PKH(myAddress))
        await p2pkh.connect(getDefaultSigner())

        const counter = await transferToCounter(p2pkh)
        await expect(counterTransfer(counter)).not.to.be.rejected
    })
})
