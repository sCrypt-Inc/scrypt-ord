/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'

import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `OrdP2PKH`', () => {
    describe('hold bsv20', () => {
        const tick = 'DOGE'

        let ordP2PKH: OrdP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const address = await signer.getDefaultAddress()
            ordP2PKH = OrdP2PKH.fromAddress(address)
            ordP2PKH.setBSV20(tick, 1000n)
            await ordP2PKH.connect(getDefaultSigner())
            await ordP2PKH.deploy(1)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()
                const { tx, tokenChangeP2PKH, receiver } =
                    await ordP2PKH.transferBsv20(address, 100n)

                console.log('transfer tx: ', tx.id)

                expect(receiver.getBSV20Amt()).to.equal(100n)

                expect(tokenChangeP2PKH).not.to.be.null

                if (tokenChangeP2PKH) {
                    expect(tokenChangeP2PKH.getBSV20Amt()).to.equal(900n)
                }
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('hold NFT', () => {
        let ordP2PKH: OrdP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const address = await signer.getDefaultAddress()
            ordP2PKH = OrdP2PKH.fromAddress(address)
            ordP2PKH.setNFT({
                content: 'hello, sCrypt!',
                contentType: 'text/plain',
            })
            await ordP2PKH.connect(getDefaultSigner())
            await ordP2PKH.deploy(1)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()
                const tx = await ordP2PKH.transferNFT(address)
                console.log('transfer tx: ', tx.id)
            }
            await expect(callContract()).not.rejected
        })
    })
})
