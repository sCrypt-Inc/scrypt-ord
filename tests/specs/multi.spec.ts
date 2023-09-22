/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { sha256, toByteString } from 'scrypt-ts'
import { HashPuzzleFT } from '../contracts/hashPuzzleFT'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH, FTReceiver, fromByteString } from '../scrypt-ord'
import { dummyAppendbsv20 } from './utils'
use(chaiAsPromised)

describe('Test multi inputs and outputs', () => {
    const tick = toByteString('OOO1', true)
    const max = 21000000n
    const lim = max

    before(async () => {
        HashPuzzleFT.loadArtifact()
    })

    it('should transfer 2 ordp2kh to 1 hashPuzzle successfully.', async () => {
        const signer = getDefaultSigner()
        const address = await signer.getDefaultAddress()
        const ordP2PKHs = [
            dummyAppendbsv20(address, fromByteString(tick), 4n),
            dummyAppendbsv20(address, fromByteString(tick), 5n),
        ].map((utxo) => OrdP2PKH.fromP2PKH(utxo))

        const message = toByteString('hello, sCrypt!', true)

        await Promise.all(ordP2PKHs.map((p) => p.connect(signer)))
        const recipients: Array<FTReceiver> = [
            {
                instance: new HashPuzzleFT(tick, max, lim, sha256(message)),
                amt: 6n,
            },
        ]

        const { tx, nexts } = await OrdP2PKH.transfer(
            ordP2PKHs,
            signer,
            recipients
        )

        console.log('transfer tx:', tx.id)

        const receiver1 = nexts[0].instance as HashPuzzleFT
        expect(receiver1.getAmt()).to.be.equal(6n)

        // has a token change output
        expect(nexts.length).to.be.equal(2)

        const tokenchange = nexts[1].instance as OrdP2PKH
        expect(tokenchange.getBSV20Amt()).to.be.equal(3n)
    })

    it('should transfer 2 ordp2kh to 2 hashPuzzle successfully.', async () => {
        const signer = getDefaultSigner()
        const address = await signer.getDefaultAddress()
        const ordP2PKHs = [
            dummyAppendbsv20(address, fromByteString(tick), 4n),
            dummyAppendbsv20(address, fromByteString(tick), 5n),
        ].map((utxo) => OrdP2PKH.fromP2PKH(utxo))

        await Promise.all(ordP2PKHs.map((p) => p.connect(signer)))

        const message1 = toByteString('1:hello, sCrypt!', true)
        const message2 = toByteString('2:hello, sCrypt!', true)

        const recipients: Array<FTReceiver> = [
            {
                instance: new HashPuzzleFT(tick, max, lim, sha256(message1)),
                amt: 6n,
            },
            {
                instance: new HashPuzzleFT(tick, max, lim, sha256(message2)),
                amt: 3n,
            },
        ]

        const { tx, nexts } = await OrdP2PKH.transfer(
            ordP2PKHs,
            signer,
            recipients
        )

        console.log('transfer tx:', tx.id)

        const receiver1 = nexts[0].instance as HashPuzzleFT
        expect(receiver1.getAmt()).to.be.equal(6n)

        const receiver2 = nexts[1].instance as HashPuzzleFT
        expect(receiver2.getAmt()).to.be.equal(3n)

        // no token change output
        expect(nexts.length).to.be.equal(2)
    })
})
