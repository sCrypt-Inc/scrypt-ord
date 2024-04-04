import { Addr, PubKey, findSig, fromByteString, toByteString } from "scrypt-ts"
import { BSV20V1P2PKH, BSV20V2P2PKH, Ordinal } from "../scrypt-ord"
import { myAddress, myPublicKey } from "../utils/privateKey"
import { getDefaultSigner } from "../utils/txHelper"
import { expect, use } from "chai"
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test `fromTx`', () => {

    it('BSV20V1P2PKH', async () => {
        const tick = toByteString('abcd', true)
        const max = 100n
        const lim = 10n
        const dec = 0n
        const addr = Addr(myAddress.toByteString())
        // mint token
        const instance = new BSV20V1P2PKH(tick, max, lim, dec, addr)
        await instance.connect(getDefaultSigner())
        await instance.deployToken()
        const mintTx = await instance.mint(lim)
        // recover instance from the mint tx
        const recoveredInstance = BSV20V1P2PKH.fromTx(mintTx, 0)
        await recoveredInstance.connect(getDefaultSigner())
        // call
        const callContract = async () => recoveredInstance.methods.unlock(
            (sigResps) => findSig(sigResps, myPublicKey),
            PubKey(myPublicKey.toHex()),
            {
                pubKeyOrAddrToSign: myPublicKey,
                transfer: {
                    instance: new BSV20V1P2PKH(tick, max, lim, dec, addr),
                    amt: 1n
                }
            }
        )
        return expect(callContract()).not.rejected
    })

    it('BSV20V2P2PKH', async () => {
        const sym = toByteString('abcd', true)
        const amt = 100n
        const dec = 0n
        const addr = Addr(myAddress.toByteString())
        // deploy token
        const instance = new BSV20V2P2PKH(toByteString(''), sym, amt, dec, addr)
        await instance.connect(getDefaultSigner())
        instance.prependNOPScript(Ordinal.createDeployV2(
            fromByteString(instance.sym),
            instance.max,
            instance.dec,
        ))
        const deployTx = await instance.deploy(1)
        const tokenId = toByteString(`${deployTx.id}_0`, true)
        // recover instance from the deploy tx
        const recoveredInstance = BSV20V2P2PKH.fromTx(deployTx, 0)
        await recoveredInstance.connect(getDefaultSigner())
        // call
        const callContract = async () => recoveredInstance.methods.unlock(
            (sigResps) => findSig(sigResps, myPublicKey),
            PubKey(myPublicKey.toHex()),
            {
                pubKeyOrAddrToSign: myPublicKey,
                transfer: {
                    instance: new BSV20V2P2PKH(tokenId, sym, amt, dec, addr),
                    amt: 1n
                }
            }
        )
        return expect(callContract()).not.rejected
    })
})
