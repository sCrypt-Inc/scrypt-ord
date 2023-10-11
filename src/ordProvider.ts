import {
    bsv,
    Provider,
    ProviderEvent,
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
export class OrdProvider extends Provider {
    private network: bsv.Networks.Network = bsv.Networks.mainnet

    private _provider: Provider

    constructor(network?: bsv.Networks.Network) {
        super()
        this.network = network || bsv.Networks.mainnet
        OneSatApis.setNetwork(this.network)
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
            this.emit(ProviderEvent.Connected, true)
        } catch (error) {
            await this._provider.connect()
            this.emit(ProviderEvent.Connected, false)
        }

        return Promise.resolve(this)
    }

    updateNetwork(network: bsv.Networks.Network): void {
        this.network = network
        this.emit(ProviderEvent.NetworkChange, network)
    }

    getNetwork(): bsv.Networks.Network {
        return this.network
    }

    async sendRawTransaction(rawTxHex: string): Promise<TxHash> {
        try {
            const txid = await this._provider.sendRawTransaction(rawTxHex)

            await OneSatApis.submitTx(txid)

            return txid
        } catch (error) {
            if (
                error.response?.type === 'application/json' &&
                error.response?.body
            ) {
                throw new Error(
                    `OrdProvider ERROR: ${JSON.stringify(error.response?.body)}`
                )
            }
            throw new Error(`OrdProvider ERROR: ${error.message}`)
        }
    }

    async listUnspent(
        address: AddressOption,
        options: UtxoQueryOptions
    ): Promise<UTXO[]> {
        return this._provider.listUnspent(address, options)
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
