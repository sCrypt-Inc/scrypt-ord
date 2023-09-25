import {
    method,
    prop,
    assert,
    SigHash,
    hash256,
    Utils,
    Addr,
    MethodCallOptions,
    bsv,
    ContractTransaction,
} from 'scrypt-ts'

import { OneSatNFT, OrdP2PKH } from '../scrypt-ord'

export class CounterNFT extends OneSatNFT {
    @prop(true)
    counter: bigint

    constructor(counter: bigint) {
        super()
        this.init(counter)
        this.counter = counter
    }

    @method(SigHash.ANYONECANPAY_ALL)
    public incOnchain() {
        this.incCounter()

        const outputs = this.buildStateOutputNFT() + this.buildChangeOutput()

        assert(
            this.ctx.hashOutputs == hash256(outputs),
            'hashOutputs check failed'
        )
    }

    @method()
    public withdraw(addr: Addr) {
        this.incCounter()
        const outputs =
            Utils.buildAddressOutput(addr, 1n) +
            this.buildStateOutputNFT() +
            this.buildChangeOutput()
        assert(
            this.ctx.hashOutputs == hash256(outputs),
            'hashOutputs check failed'
        )
    }

    @method()
    incCounter(): void {
        this.counter++
    }

    static async buildTxForWithdraw(
        current: CounterNFT,
        options: MethodCallOptions<CounterNFT>,
        addr: Addr
    ): Promise<ContractTransaction> {
        const defaultAddress = await current.signer.getDefaultAddress()

        const p2pkh = new OrdP2PKH(addr)

        const nextInstance = current.next()
        nextInstance.incCounter()

        const tx = new bsv.Transaction()
            .addInput(current.buildContractInput())
            .addOutput(
                new bsv.Transaction.Output({
                    script: p2pkh.lockingScript,
                    satoshis: 1,
                })
            )
            .addOutput(
                new bsv.Transaction.Output({
                    script: nextInstance.lockingScript,
                    satoshis: current.balance,
                })
            )
            .change(options.changeAddress || defaultAddress)

        return {
            tx,
            atInputIndex: 0,
            nexts: [
                {
                    instance: p2pkh,
                    balance: 1,
                    atOutputIndex: 0,
                },
                {
                    instance: nextInstance,
                    balance: 1,
                    atOutputIndex: 1,
                },
            ],
        }
    }
}
