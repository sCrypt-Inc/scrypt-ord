/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-useless-escape */
import {
    ByteString,
    method,
    SmartContract,
    toByteString,
    Utils,
    UTXO,
    assert,
    prop,
    bsv,
    MethodCallOptions,
    ContractTransaction,
    StatefulNext,
} from 'scrypt-ts'
import { Inscription } from '../types'
import { Ordinal } from './ordinal'
import { signTx } from 'scryptlib'

export class OneSatNFT extends SmartContract {
    @prop(true)
    isOneSatNFT: boolean

    constructor() {
        super()
        this.isOneSatNFT = true
    }

    @method()
    buildStateOutputNFT(): ByteString {
        const stateScript = Ordinal.removeInsciption(this.getStateScript())
        return Utils.buildOutput(stateScript, 1n)
    }

    @method()
    static buildMintNFTOutput(
        script: ByteString,
        content: ByteString,
        contentType: ByteString
    ): ByteString {
        const part1 = Ordinal.createInsciption(content, contentType)
        const part2 = Ordinal.removeInsciption(script)
        return Utils.buildOutput(part1 + part2, 1n)
    }

    @method()
    public __scrypt_ts_base_unlock() {
        assert(false, 'should not reach here!')
    }

    static create(inscription: Inscription): bsv.Script {
        const contentTypeBytes = toByteString(inscription.contentType, true)
        const contentBytes = toByteString(inscription.content, true)
        return bsv.Script.fromASM(
            `OP_FALSE OP_IF 6f7264 OP_1 ${contentTypeBytes} OP_0 ${contentBytes} OP_ENDIF`
        )
    }

    async mint(inscription: Inscription) {
        this.prependNOPScript(OneSatNFT.create(inscription))
        return this.deploy(1)
    }

    async mintTextNft(text: string) {
        return this.mint({
            content: text,
            contentType: 'text/plain',
        })
    }

    async transfer(receiver: OneSatNFT, methodName: string, ...args) {
        const builder = this['_txBuilders'].has(methodName)

        if (!builder) {
            this.bindTxBuilder(
                methodName,
                async (
                    current: OneSatNFT,
                    options: MethodCallOptions<OneSatNFT>
                ): Promise<ContractTransaction> => {
                    const bsvChangeAddress =
                        await this.signer.getDefaultAddress()

                    const nexts: StatefulNext<OneSatNFT>[] = []
                    const tx = new bsv.Transaction()

                    tx.addInput(current.buildContractInput())

                    await receiver.connect(this.signer)

                    tx.addOutput(
                        new bsv.Transaction.Output({
                            script: receiver.lockingScript,
                            satoshis: 1,
                        })
                    )

                    nexts.push({
                        instance: receiver,
                        balance: 1,
                        atOutputIndex: nexts.length,
                    })

                    tx.change(bsvChangeAddress)

                    return Promise.resolve({
                        tx,
                        atInputIndex: 0,
                        nexts: nexts,
                    })
                }
            )
        }

        return this.methods[methodName](...args)
    }

    static send2Contract(
        ordinalUtxo: UTXO,
        ordPk: bsv.PrivateKey,
        instance: SmartContract
    ) {
        instance.buildDeployTransaction = (
            utxos: UTXO[],
            amount: number,
            changeAddress?: bsv.Address | string
        ): Promise<bsv.Transaction> => {
            const deployTx = new bsv.Transaction()

            deployTx.from(ordinalUtxo).addOutput(
                new bsv.Transaction.Output({
                    script: instance.lockingScript,
                    satoshis: amount,
                })
            )

            if (changeAddress) {
                deployTx.change(changeAddress)
            }
            const lockingScript = bsv.Script.fromHex(ordinalUtxo.script)

            const sig = signTx(
                deployTx,
                ordPk,
                lockingScript,
                amount,
                0,
                bsv.crypto.Signature.ANYONECANPAY_SINGLE
            )

            deployTx.inputs[0].setScript(
                bsv.Script.buildPublicKeyHashIn(
                    ordPk.publicKey,
                    bsv.crypto.Signature.fromTxFormat(Buffer.from(sig, 'hex')),
                    bsv.crypto.Signature.ANYONECANPAY_SINGLE
                )
            )

            return Promise.resolve(deployTx)
        }
        return instance.deploy(1)
    }

    public static async getLatestInstanceByOrigin<T extends SmartContract>(
        clazz: new (...args: any) => T,
        origin: string
    ): Promise<T> {
        const utxo = await Ordinal.fetchLatestUTXOByOrigin(origin)

        if (utxo === null) {
            throw new Error('no utxo found')
        }

        const insciptionScript = Ordinal.getInsciptionScript(utxo.script)

        const instance = (clazz as unknown as typeof SmartContract).fromUTXO(
            utxo,
            {},
            bsv.Script.fromHex(insciptionScript)
        )
        return instance as T
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static async getLatestInstanceById<T extends SmartContract>(
        clazz: new (...args: any) => T,
        inscription_Number: bigint
    ): Promise<T> {
        const origin = await Ordinal.fetchOriginById(inscription_Number)

        if (origin === null) {
            throw new Error('no origin found')
        }
        return OneSatNFT.getLatestInstanceByOrigin(clazz, origin)
    }
}
