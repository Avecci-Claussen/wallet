import { bitcoin } from '../bitcoin-core'
import { ClassicMultisigError } from './types'

const SIGHASH_ALL = 0x01

/** Treasury v1: only SIGHASH_ALL. SINGLE/NONE/ANYONECANPAY let outputs or inputs mutate after sign. */
export function assertSafeSighash(sighashType: number | undefined): void {
  const t = sighashType ?? SIGHASH_ALL
  if (t !== SIGHASH_ALL) {
    throw new ClassicMultisigError(
      'P2WSH multisig allows SIGHASH_ALL only (no NONE/SINGLE/ANYONECANPAY)',
      'SIGHASH'
    )
  }
}

/** P2WSH: scriptPubKey must be OP_0 <SHA256(witnessScript)>. Otherwise the signature cannot spend that UTXO. */
export function assertP2wshUtxoMatchesWitnessScript(
  witnessUtxo: { script: Buffer } | undefined,
  witnessScript: Buffer | undefined
): void {
  if (!witnessUtxo || !witnessScript) {
    throw new ClassicMultisigError('P2WSH input needs witnessUtxo + witnessScript', 'PSBT')
  }
  const expected = bitcoin.payments.p2wsh({
    redeem: { output: witnessScript }
  }).output
  if (!expected || !witnessUtxo.script.equals(expected)) {
    throw new ClassicMultisigError(
      'witnessUtxo.script is not SHA256(witnessScript) — refusing to sign an unbound script',
      'PSBT_BIND'
    )
  }
}

export function combineAndFinalize(psbts: bitcoin.Psbt[]): bitcoin.Transaction {
  if (psbts.length < 1) {
    throw new ClassicMultisigError('No PSBTs to combine', 'PSBT')
  }
  let acc = psbts[0]!
  for (let i = 0; i < acc.inputCount; i++) {
    const data = acc.data.inputs[i]
    assertSafeSighash(data?.sighashType)
    assertP2wshUtxoMatchesWitnessScript(data?.witnessUtxo, data?.witnessScript)
  }
  for (let i = 1; i < psbts.length; i++) {
    acc = acc.combine(psbts[i]!)
  }
  acc.finalizeAllInputs()
  return acc.extractTransaction()
}
