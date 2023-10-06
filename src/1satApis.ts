import { UTXO, bsv } from 'scrypt-ts'

import superagent from 'superagent'
import { handlerApiError } from './utils'

export class OneSatApis {
    private network: bsv.Networks.Network = bsv.Networks.mainnet

    private static get apiBase() {
        return 'https://test.ordinals.gorillapool.io/api'
    }

    static fetchUTXOByOutpoint(outpoint: string): UTXO | null {
        const url = `${this.apiBase}/txos/${outpoint}?script=true`

        return superagent
            .get(url)
            .then(function (response) {
                // handle success
                const script = Buffer.from(
                    response.body.script,
                    'base64'
                ).toString('hex')
                return {
                    txId: response.body.txid,
                    outputIndex: response.body.vout,
                    satoshis: 1,
                    script,
                }
            })
            .catch(function (error) {
                // handle error
                handlerApiError(error)
                return null
            })
    }

    static async fetchLatestByOrigin(origin: string): Promise<UTXO | null> {
        const url = `${this.apiBase}/inscriptions/${origin}/latest?script=true`

        const res = await superagent
            .get(url)
            .then(function (response) {
                // handle success
                return response.body
            })
            .catch(function (error) {
                // handle error
                handlerApiError(error)
                return null
            })

        if (!res) {
            return null
        }

        const { spend, txid, vout, script } = res
        if (spend) {
            return null
        }

        return {
            txId: txid,
            outputIndex: vout,
            satoshis: 1,
            script: Buffer.from(script, 'base64').toString('hex'),
        }
    }

    static fetchBSV20Utxos(
        address: string,
        tick: string
    ): Promise<Array<UTXO>> {
        const url = `${this.apiBase}/bsv20/${address}/tick/${tick}`

        return superagent
            .get(url)
            .then(function (response) {
                // handle success
                if (Array.isArray(response.body)) {
                    return Promise.all(
                        response.body.map((utxo) => {
                            return OneSatApis.fetchUTXOByOutpoint(utxo.outpoint)
                        })
                    )
                }
                return []
            })
            .catch(function (error) {
                handlerApiError(error)
                return []
            })
    }

    static fetchBSV20V2Utxos(
        address: string,
        id: string
    ): Promise<Array<UTXO>> {
        const url = `${this.apiBase}/bsv20/${address}/id/${id}`

        return superagent
            .get(url)
            .then(function (response) {
                // handle success
                if (Array.isArray(response.body)) {
                    return Promise.all(
                        response.body.map((utxo) => {
                            return OneSatApis.fetchUTXOByOutpoint(utxo.outpoint)
                        })
                    )
                }
                return []
            })
            .catch(function (error) {
                handlerApiError(error)
                return []
            })
    }
}
