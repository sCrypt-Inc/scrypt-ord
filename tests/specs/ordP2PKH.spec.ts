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
                const { tx, nexts } = await ordP2PKH.transferBsv20(
                    address,
                    100n
                )

                console.log('transfer tx: ', tx.id)

                const receiver = nexts[0].instance as OrdP2PKH

                expect(receiver.getBSV20Amt()).to.equal(100n)

                const tokenChangeP2PKH = nexts[1].instance as OrdP2PKH

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

    describe('from v1 utxo', () => {
        let ordP2PKH: OrdP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            ordP2PKH = OrdP2PKH.fromP2PKHUTXO({
                script: `76a914${addr.toByteString()}88ac0063036f726451126170706c69636174696f6e2f6273762d323000367b2270223a226273762d3230222c226f70223a227472616e73666572222c227469636b223a224c554e43222c22616d74223a2231227d68`,
                satoshis: 1,
                txId: '342254427346e024fdb6f3a6eb37e1734e54da733a167d95cb035c3c306b1e9b',
                outputIndex: 0,
            })

            await ordP2PKH.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()
                const { tx, nexts } = await ordP2PKH.transferBsv20(address, 1n)

                console.log('transfer tx: ', tx.id)
                const receiver = nexts[0].instance as OrdP2PKH

                expect(receiver.getBSV20Amt()).to.equal(1n)

                expect(nexts.length === 1).to.be.true
            }

            await expect(callContract()).not.rejected
        })
    })

    describe('from v2 utxo', () => {
        let ordP2PKH: OrdP2PKH
        const signer = getDefaultSigner()
        before(async () => {
            const addr = await signer.getDefaultAddress()
            ordP2PKH = OrdP2PKH.fromP2PKHUTXO({
                script: `0063036f726451126170706c69636174696f6e2f6273762d323000367b2270223a226273762d3230222c226f70223a227472616e73666572222c227469636b223a224c554e43222c22616d74223a2236227d6876a914${addr.toByteString()}88ac`,
                satoshis: 1,
                txId: '26d71a702a33c75e66e7c7680e68b82886ce9fc1f54c563484265cb985b72e5f',
                outputIndex: 0,
            })

            await ordP2PKH.connect(signer)
        })

        it('transfer should pass.', async () => {
            const callContract = async () => {
                const address = await signer.getDefaultAddress()
                const { tx, nexts } = await ordP2PKH.transferBsv20(address, 2n)

                console.log('transfer tx: ', tx.id)
                const receiver = nexts[0].instance as OrdP2PKH

                expect(receiver.getBSV20Amt()).to.equal(2n)

                expect(nexts.length === 2).to.be.true

                const change = nexts[1].instance as OrdP2PKH

                expect(change.getBSV20Amt()).to.equal(4n)
            }

            await expect(callContract()).not.rejected
        })
    })
})
