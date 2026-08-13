import { bitcoin } from '../bitcoin-core'
import { ClassicMultisigError } from './types'
import { assertP2wshUtxoMatchesWitnessScript } from './psbt'

const SIGHASH_ALL = 0x01
const DUST = 330

export type SortedMultiSpendUtxo = {
  txid: string
  vout: number
  value: number
  script: Buffer
  witnessScript: Buffer
}

export type SortedMultiPsbtSummary = {
  fee: number
  send: number
  change: number
  sighash: 'SIGHASH_ALL'
  inputs: { txid: string; vout: number; value: number }[]
  outputs: { address: string; value: number; isChange: boolean; isAddress: boolean }[]
}

function varSliceLen(n: number): number {
  return n < 253 ? 1 + n : 3 + n
}

/** Conservative vbyte size for native P2WSH m-of-n inputs (CHECKMULTISIG + dummy). */
export function estimateP2wshMofNVbytes(k: number, n: number, inputCount: number, outputCount: number): number {
  const script = 3 + n * 34
  const witness = 1 + k * 73 + varSliceLen(script)
  const inputV = 41 + Math.ceil(witness / 4)
  return Math.ceil(10.5 + inputV * inputCount + 43 * outputCount)
}

function selectUtxos(
  utxos: SortedMultiSpendUtxo[],
  send: number,
  feeRate: number,
  k: number,
  n: number
): { chosen: SortedMultiSpendUtxo[]; fee: number; change: number } {
  const sorted = [...utxos].sort((a, b) => b.value - a.value)
  const chosen: SortedMultiSpendUtxo[] = []
  let inValue = 0
  for (const u of sorted) {
    chosen.push(u)
    inValue += u.value
    const fee2 = Math.ceil(estimateP2wshMofNVbytes(k, n, chosen.length, 2) * feeRate)
    if (inValue >= send + fee2) {
      const change = inValue - send - fee2
      if (change >= DUST) return { chosen, fee: fee2, change }
      const fee1 = Math.ceil(estimateP2wshMofNVbytes(k, n, chosen.length, 1) * feeRate)
      if (inValue >= send + fee1) return { chosen, fee: inValue - send, change: 0 }
    }
  }
  throw new ClassicMultisigError('Insufficient value for send + fee', 'INSUFFICIENT')
}

export function buildSortedMultiSpendPsbt(opts: {
  network: bitcoin.Network
  utxos: SortedMultiSpendUtxo[]
  toAddress: string
  send: number
  changeAddress: string
  feeRate: number
  k: number
  n: number
}): { psbt: bitcoin.Psbt; fee: number; change: number } {
  if (!Number.isInteger(opts.send) || opts.send <= 0) {
    throw new ClassicMultisigError('Invalid send amount', 'AMOUNT')
  }
  if (!Number.isFinite(opts.feeRate) || opts.feeRate <= 0) {
    throw new ClassicMultisigError('Invalid fee rate', 'FEE')
  }
  if (opts.toAddress === opts.changeAddress) {
    throw new ClassicMultisigError('Destination must not be the change address', 'CHANGE')
  }
  const { chosen, fee, change } = selectUtxos(opts.utxos, opts.send, opts.feeRate, opts.k, opts.n)
  const psbt = new bitcoin.Psbt({ network: opts.network })
  psbt.setVersion(2)
  for (const u of chosen) {
    assertP2wshUtxoMatchesWitnessScript({ script: u.script }, u.witnessScript)
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      sequence: 0xfffffffd,
      witnessUtxo: { script: u.script, value: u.value },
      witnessScript: u.witnessScript,
      sighashType: SIGHASH_ALL
    })
  }
  psbt.addOutput({ address: opts.toAddress, value: opts.send })
  if (change > 0) {
    psbt.addOutput({ address: opts.changeAddress, value: change })
  }
  return { psbt, fee, change }
}

export function summarizeSortedMultiPsbt(
  psbt: bitcoin.Psbt,
  changeAddresses: Set<string>,
  network: bitcoin.Network
): SortedMultiPsbtSummary {
  const inputs = psbt.data.inputs.map((data, i) => {
    assertP2wshUtxoMatchesWitnessScript(data.witnessUtxo, data.witnessScript)
    const t = data.sighashType ?? SIGHASH_ALL
    if (t !== SIGHASH_ALL) {
      throw new ClassicMultisigError('P2WSH multisig allows SIGHASH_ALL only', 'SIGHASH')
    }
    const txIn = psbt.txInputs[i]
    const txid = txIn?.hash ? Buffer.from(txIn.hash).reverse().toString('hex') : ''
    return {
      txid,
      vout: txIn?.index ?? i,
      value: data.witnessUtxo!.value
    }
  })
  const outputs = psbt.txOutputs.map((o) => {
    let address = ''
    let isAddress = false
    try {
      address = bitcoin.address.fromOutputScript(o.script, network)
      isAddress = true
    } catch {
      address = o.script.toString('hex')
    }
    return {
      address,
      value: o.value,
      isChange: isAddress && changeAddresses.has(address),
      isAddress
    }
  })
  const inSum = inputs.reduce((s, x) => s + x.value, 0)
  const outSum = outputs.reduce((s, x) => s + x.value, 0)
  const change = outputs.filter((o) => o.isChange).reduce((s, x) => s + x.value, 0)
  const send = outSum - change
  return {
    fee: inSum - outSum,
    send,
    change,
    sighash: 'SIGHASH_ALL',
    inputs,
    outputs
  }
}

/** v1: exactly one decoded-address payment; any other output must be this wallet’s change. */
export function assertP2wshSpendShape(summary: SortedMultiPsbtSummary): void {
  const pays = summary.outputs.filter((o) => !o.isChange)
  const pay = pays[0]
  if (pays.length !== 1 || !pay || !pay.isAddress || pay.value <= 0) {
    throw new ClassicMultisigError('P2WSH spend must have exactly one payment output', 'OUTPUTS')
  }
}
