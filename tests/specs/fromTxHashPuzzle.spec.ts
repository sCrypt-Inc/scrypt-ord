/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { toByteString, bsv } from 'scrypt-ts'
import { HashPuzzle } from '../contracts/hashPuzzle'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH, Ordinal } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test SmartContract `HashPuzzle`', () => {
    const message1 = toByteString('hello, sCrypt!', true)

    let hashPuzzle: HashPuzzle

    before(async () => {
        HashPuzzle.loadArtifact()

        const utxo = await Ordinal.fetchUTXOByOutpoint(
            '1f3a40d41b775380c9d84ab89d9e21bebd2eb6f50676de004048285892512715_0'
        )

        if (utxo === null) {
            throw new Error('no utxo found')
        }

        hashPuzzle = HashPuzzle.fromUTXO(
            utxo,
            {},
            bsv.Script.fromHex(Ordinal.getInsciptionScript(utxo.script))
        )

        const signer = getDefaultSigner()
        await hashPuzzle.connect(signer)
    })

    it('should withdraw from  hashPuzzle successfully.', async () => {
        const callContract = async () => {
            const address = await hashPuzzle.signer.getDefaultAddress()
            const { tx, tokenChangeP2PKH } = await hashPuzzle.transfer(
                [
                    {
                        instance: OrdP2PKH.fromAddress(address),
                        amt: 6n,
                    },
                ],
                'unlock',
                message1
            )

            console.log('withdraw bsv20 to p2pkh: ', tx.id)

            expect(tokenChangeP2PKH).to.be.null
        }

        await expect(callContract()).not.rejected
    })
})
