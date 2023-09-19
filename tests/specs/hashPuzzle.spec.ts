/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, use } from 'chai'
import {
    ContractTransaction,
    MethodCallOptions,
    sha256,
    toByteString,
    bsv,
    findSig,
    toHex,
    PubKey,
} from 'scrypt-ts'
import { HashPuzzle } from '../contracts/hashPuzzle'
import { getDefaultSigner } from '../utils/txHelper'

import chaiAsPromised from 'chai-as-promised'
import { BSV20P2PKH } from '../../src/contracts/bsv20P2PKH'
use(chaiAsPromised)

describe('Test SmartContract `HashPuzzle`', () => {
    const tick = 'DOGE'
    const max = 100000n
    const lim = max / 10n
    const amt = lim

    const message1 = toByteString('hello, sCrypt!', true)
    const message2 = toByteString('hello, 1SAT!', true)

    let hashPuzzle: HashPuzzle
    before(async () => {
        await HashPuzzle.loadArtifact()
        hashPuzzle = new HashPuzzle(
            toByteString(tick, true),
            max,
            lim,
            sha256(message1)
        )
        await hashPuzzle.connect(getDefaultSigner())

        await hashPuzzle.deployToken()
        await hashPuzzle.mint(amt)
    })

    it('should pass the public method unit test successfully.', async () => {
        const tokenChangeAddress = await hashPuzzle.signer.getDefaultAddress()
        const tokenChangePubkey = await hashPuzzle.signer.getDefaultPubKey()

        const callContract = async () => {
            const { tx, tokenChange, receivers } = await hashPuzzle.transfer(
                [
                    {
                        instance: new HashPuzzle(
                            toByteString(tick, true),
                            max,
                            lim,
                            sha256(message2)
                        ),
                        amt: 10n,
                    },
                ],
                tokenChangeAddress,
                'unlock',
                message1
            )

            console.log('transfer tx: ', tx.id)

            if (tokenChange) {
                await tokenChange.connect(getDefaultSigner())
                const burn = async () => {
                    const tx = await tokenChange.burn(
                        'unlock',
                        (sigResps) => findSig(sigResps, tokenChangePubkey),
                        PubKey(toHex(tokenChangePubkey)),
                        {
                            pubKeyOrAddrToSign: tokenChangePubkey,
                        } as MethodCallOptions<BSV20P2PKH>
                    )
                    console.log('burn tx: ', tx.id)
                }
                await expect(burn()).not.rejected
            }

            const burn1 = async () => {
                const receiver = receivers[0]
                const tx = await receiver.burn('unlock', message2)
                console.log('burn tx: ', tx.id)
            }
            await expect(burn1()).not.rejected
        }

        await expect(callContract()).not.rejected
    })
})
