/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-useless-escape */
import {
    ByteString,
    len,
    method,
    OpCode,
    slice,
    SmartContract,
    toByteString,
    Utils,
    byteString2Int,
    VarIntWriter,
    assert,
    prop,
    bsv,
    MethodCallOptions,
    ContractTransaction,
    StatefulNext,
} from 'scrypt-ts'
import { Inscription } from '../inscription'
import { Ordinal } from './ordinal'

export class OneSatNFT extends SmartContract {
    @prop(true)
    isOneSatNFT: boolean

    constructor() {
        super()
        this.isOneSatNFT = true
    }

    @method()
    build1SatStateOutput(): ByteString {
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
    public __scrypt__unlock() {
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
}
