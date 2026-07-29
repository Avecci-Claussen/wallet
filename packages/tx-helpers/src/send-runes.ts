import bigInt from 'big-integer'

import { createTx } from './transaction/transaction'
import { utxoHelper } from './transaction/utxo'
import { UnspentOutput } from './types'
import { Edict, RuneId, Runestone } from '@unisat/alkanes-lib'
import { bitcoin } from '@unisat/wallet-bitcoin'
import { NetworkType } from '@unisat/wallet-types'
import { ToSignInput } from '@unisat/keyring-service/types'
import { ErrorCodes, WalletError } from '@unisat/wallet-shared'

// only one arc20 can be send
export async function sendRunes({
  assetUtxos,
  btcUtxos,
  assetAddress,
  btcAddress,
  toAddress,
  networkType,
  runeid,
  runeAmount,
  outputValue,
  feeRate,
  enableRBF = true,
}: {
  assetUtxos: UnspentOutput[]
  btcUtxos: UnspentOutput[]
  assetAddress: string
  btcAddress: string
  toAddress: string
  networkType: NetworkType
  runeid: string
  runeAmount: string
  outputValue: number
  feeRate: number
  enableRBF?: boolean
}) {
  // safe check
  if (utxoHelper.hasInscription(assetUtxos)) {
    throw new WalletError(ErrorCodes.NOT_SAFE_UTXOS)
  }

  if (utxoHelper.hasAnyAssets(btcUtxos)) {
    throw new WalletError(ErrorCodes.NOT_SAFE_UTXOS)
  }

  const tx = createTx({ networkType, feeRate, changeAddress: btcAddress, enableRBF })

  const toSignInputs: ToSignInput[] = []

  // add assets
  assetUtxos.forEach((v, index) => {
    tx.addInput(v)
    toSignInputs.push({ index, publicKey: v.pubkey })
  })

  let fromRuneAmount = bigInt(0)
  let hasMultipleRunes = false
  let runesMap: { [key: string]: boolean } = {}
  assetUtxos.forEach(v => {
    if (v.runes) {
      v.runes.forEach(w => {
        runesMap[w.runeid] = true
        if (w.runeid === runeid) {
          fromRuneAmount = fromRuneAmount.plus(bigInt(w.amount))
        }
      })
    }
  })

  if (Object.keys(runesMap).length > 1) {
    hasMultipleRunes = true
  }

  const changedRuneAmount = fromRuneAmount.minus(bigInt(runeAmount))

  if (changedRuneAmount.lt(0)) {
    throw new WalletError(ErrorCodes.INSUFFICIENT_ASSET_UTXO)
  }

  let needChange = false
  if (hasMultipleRunes || changedRuneAmount.gt(0)) {
    needChange = true
  }

  const runeId = RuneId.fromString(runeid)
  const runeOutput = needChange ? 2 : 1
  const payload = new Runestone({
    edicts: [new Edict({ id: runeId, amount: BigInt(runeAmount), output: runeOutput })],
  }).encipher()

  // add op_return
  tx.addScriptOutput(
    // OUTPUT_0
    bitcoin.script.compile([
      bitcoin.opcodes['OP_RETURN']!,
      bitcoin.opcodes['OP_13']!,
      Buffer.from(payload, 'hex'),
    ]),
    0
  )

  if (needChange) {
    // OUTPUT_1
    // add change
    tx.addOutput(assetAddress, outputValue)
  }

  tx.addOutput(toAddress, outputValue)

  // add btc
  const _toSignInputs = await tx.addSufficientUtxosForFee(btcUtxos, true)
  toSignInputs.push(..._toSignInputs)

  const psbt = tx.toPsbt()

  return { psbt, toSignInputs }
}
