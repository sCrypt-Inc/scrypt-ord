import { UTXO, bsv } from 'scrypt-ts'

import superagent from 'superagent'
import { handlerApiError, isBSV20v2 } from './utils'

export class OneSatApis {
    private static apiBase(network: bsv.Networks.Network) {
        return network === bsv.Networks.mainnet
            ? 'https://ordinals.gorillapool.io/api'
            : 'https://testnet.ordinals.gorillapool.io/api'
    }

    static fetchUTXOByOutpoint(
        outpoint: string,
        network?: bsv.Networks.Network
    ): Promise<UTXO | null> {
        const url = `${this.apiBase(
            network || bsv.Networks.mainnet
        )}/txos/${outpoint}?script=true`

        return superagent
            .get(url)
            .then(function (response: superagent.Response) {
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

    static async fetchLatestByOrigin(
        origin: string,
        network?: bsv.Networks.Network
    ): Promise<UTXO | null> {
        const url = `${this.apiBase(
            network || bsv.Networks.mainnet
        )}/inscriptions/${origin}/latest?script=true`

        const res = await superagent
            .get(url)
            .then(function (response: superagent.Response) {
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
        const network = bsv.Address.fromString(address).network
        const url = isBSV20v2(tick)
            ? `${this.apiBase(
                  network || bsv.Networks.mainnet
              )}/bsv20/${address}/id/${tick}`
            : `${this.apiBase(
                  network || bsv.Networks.mainnet
              )}/bsv20/${address}/tick/${tick}`

        return superagent
            .get(url)
            .then(async function (response: superagent.Response) {
                // handle success
                if (Array.isArray(response.body)) {
                    const utxos = await Promise.all(
                        response.body.map((utxo) => {
                            return OneSatApis.fetchUTXOByOutpoint(
                                utxo.outpoint,
                                network
                            )
                        })
                    )

                    return utxos.filter((u) => u !== null) as Array<UTXO>
                }
                return []
            })
            .catch(function (error) {
                handlerApiError(error)
                return []
            })
    }

    static postTx(
        rawtx: string,
        network?: bsv.Networks.Network
    ): Promise<string> {
        const url = `${this.apiBase(network || bsv.Networks.mainnet)}/tx`
        return superagent
            .post(url)
            .send({
                rawtx: Buffer.from(rawtx, 'hex').toString('base64'),
            })
            .then(function (response: superagent.Response) {
                // handle success
                if (response.status !== 200) {
                    throw new Error(`invalid status: ${response.status}`)
                }

                return response.body
            })
            .catch(function (error) {
                handlerApiError(error)
                return
            })
    }
    static submitTx(
        txid: string,
        network?: bsv.Networks.Network
    ): Promise<void> {
        const url = `${this.apiBase(
            network || bsv.Networks.mainnet
        )}/tx/${txid}/submit`
        return superagent
            .post(url)
            .then(function (response: superagent.Response) {
                // handle success
                if (response.status !== 204) {
                    throw new Error(`invalid status: ${response.status}`)
                }

                return
            })
            .catch(function (error) {
                handlerApiError(error)
                return
            })
    }
}
