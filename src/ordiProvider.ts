import {
    bsv,
    Provider,
    TransactionResponse,
    TxHash,
    UtxoQueryOptions,
    AddressOption,
    UTXO,
    DefaultProvider,
} from 'scrypt-ts'

import { OneSatApis } from './1satApis'

/**
 * The OrdProvider is backed by [gorillapool]{@link https://v3.ordinals.gorillapool.io/api/docs},
 *
 */
export class OrdiProvider extends Provider {
    private network: bsv.Networks.Network = bsv.Networks.mainnet

    private _provider: Provider

    constructor(network?: bsv.Networks.Network) {
        super()
        this.network = network || bsv.Networks.mainnet
        this._provider = new DefaultProvider({
            network: this.network,
        })
    }

    isConnected(): boolean {
        return this._provider.isConnected()
    }

    async connect(): Promise<this> {
        try {
            await this._provider.connect()
            this.emit('connected', true)
        } catch (error) {
            await this._provider.connect()
            this.emit('connected', false)
        }

        return Promise.resolve(this)
    }

    updateNetwork(network: bsv.Networks.Network): void {
        this.network = network
        this._provider.updateNetwork(network)
        this.emit('networkChange', network)
    }

    getNetwork(): bsv.Networks.Network {
        return this.network
    }

    async sendRawTransaction(rawTxHex: string): Promise<TxHash> {
        try {

            const txid = await OneSatApis.postTx(rawTxHex, this.network)


            return txid
        } catch (error) {
            throw new Error(`OrdProvider ERROR: ${error}`)
        }
    }

    async listUnspent(
        address: AddressOption,
        options: UtxoQueryOptions
    ): Promise<UTXO[]> {
        return this._provider.listUnspent(address, options).then((utxos) => {
            return utxos.filter((u) => u.satoshis > 1)
        })
    }

    getBalance(
        address: AddressOption
    ): Promise<{ confirmed: number; unconfirmed: number }> {
        return this._provider.getBalance(address)
    }

    getTransaction(txHash: string): Promise<TransactionResponse> {
        return this._provider.getTransaction(txHash)
    }

    getFeePerKb(): Promise<number> {
        return this._provider.getFeePerKb()
    }
}
