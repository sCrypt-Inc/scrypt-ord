import { expect, use } from 'chai'
import { Addr, sha256, toByteString } from 'scrypt-ts'
import { HashLockNFT } from '../contracts/hashLockNFT'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OrdiNFTP2PKH } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `HashLockNFT`', () => {
    const text = 'Hello sCrypt and 1Sat Oridinals'
    const message = toByteString(text, true)
    const hash = sha256(message)

    let instance: HashLockNFT

    before(async () => {
        HashLockNFT.loadArtifact()
        instance = new HashLockNFT(hash)
        await instance.connect(getDefaultSigner())
        await instance.inscribeText(text)
    })

    it('should pass when transfer NFT', async () => {
        const ordAddress = await instance.signer.getDefaultAddress()
        const call = async () =>
            await instance.methods.unlock(message, {
                transfer: new OrdiNFTP2PKH(Addr(ordAddress.toByteString())),
            })
        await expect(call()).not.to.be.rejected
    })

    it('should pass when calling `unlock`, this will burn the NFT', async () => {
        const call = async () => await instance.methods.unlock(message)
        await expect(call()).to.be.rejectedWith(/No NFTReceiver found/)
    })

    it('should fail when passing incorrect message', async () => {
        const ordAddress = await instance.signer.getDefaultAddress()
        const call = async () =>
            await instance.methods.unlock(toByteString(''), {
                transfer: new OrdiNFTP2PKH(Addr(ordAddress.toByteString())),
            })
        await expect(call()).to.be.rejectedWith(/hashes are not equal/)
    })

    it('should fail w/ w wrong transfer', async () => {
        const ordAddress = await instance.signer.getDefaultAddress()
        const call = async () =>
            await instance.methods.unlock(message, {
                transfer: [
                    new OrdiNFTP2PKH(Addr(ordAddress.toByteString())),
                    new OrdiNFTP2PKH(Addr(ordAddress.toByteString())),
                ],
            })
        await expect(call()).to.be.rejectedWith(
            /Transfer option must be of type `SmartContract`./
        )
    })
})
