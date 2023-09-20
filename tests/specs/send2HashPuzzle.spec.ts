/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { sha256, toByteString } from 'scrypt-ts'
import { HashPuzzle } from '../contracts/hashPuzzle'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { BSV20V1 } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `HashPuzzle`', () => {
    const tick = 'LUNC'
    const max = 21000000n
    const lim = max

    const message1 = toByteString('hello, sCrypt!', true)

    let hashPuzzle: HashPuzzle

    before(async () => {
        HashPuzzle.loadArtifact()
        hashPuzzle = new HashPuzzle(
            toByteString(tick, true),
            max,
            lim,
            sha256(message1)
        )

        const signer = getDefaultSigner()
        await hashPuzzle.connect(signer)

        const address = await signer.getDefaultAddress()
        const ordP2PKHs = await BSV20V1.getOrdP2PKHs(tick, address.toString())

        await Promise.all(ordP2PKHs.map((p) => p.connect(signer)))

        const tx = await BSV20V1.send2Contract(
            ordP2PKHs,
            signer,
            hashPuzzle,
            6n
        )

        console.log('tx:', tx.id)
    })

    it('should withdraw from  hashPuzzle successfully.', async () => {
        const callContract = async () => {
            const { tx, tokenChangeP2PKH } = await hashPuzzle.transfer(
                [],
                'unlock',
                message1
            )
            expect(tokenChangeP2PKH?.getBSV20Amt()).to.be.equal(6n)
            console.log('transfer to  tokenChangeP2PKH: ', tx.id)
        }

        await expect(callContract()).not.rejected
    })
})
