/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import { toByteString, bsv, MethodCallOptions } from 'scrypt-ts'
import { HashPuzzleFT } from '../contracts/hashPuzzleFT'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH, Ordinal } from '../scrypt-ord'
use(chaiAsPromised)

describe('Test BSV20 fromUTXO', () => {
    const message1 = toByteString('hello, sCrypt!', true)

    let hashPuzzle: HashPuzzleFT

    before(async () => {
        HashPuzzleFT.loadArtifact()

        // const utxo = await Ordinal.fetchUTXOByOutpoint(
        //     '1f3a40d41b775380c9d84ab89d9e21bebd2eb6f50676de004048285892512715_0'
        // )

        // if (utxo === null) {
        //     throw new Error('no utxo found')
        // }

        const utxo = {
            script: '0063036f726451126170706c69636174696f6e2f6273762d323000367b2270223a226273762d3230222c226f70223a227472616e73666572222c227469636b223a224c554e43222c22616d74223a2236227d6800000000044c554e4304406f400104406f400120eb2c9ad39d81bbe2acbec6f42859d94f86226186838560f3a698d9047f49ce72615379577a75567a567a567a567a567a567a51587a75577a577a577a577a577a577a577a0079567a75557a557a557a557a557a757575756151795579a88777777777776a00010200000000',
            satoshis: 1,
            txId: '1f3a40d41b775380c9d84ab89d9e21bebd2eb6f50676de004048285892512715',
            outputIndex: 0,
        }

        hashPuzzle = HashPuzzleFT.fromUTXO(
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
            const { tx } = await hashPuzzle.methods.unlock(message1, {
                transfer: [
                    {
                        instance: OrdP2PKH.fromAddress(address),
                        amt: 6n,
                    },
                ],
            } as MethodCallOptions<HashPuzzleFT>)

            console.log('withdraw bsv20 to p2pkh: ', tx.id)
        }

        await expect(callContract()).not.rejected
    })
})
