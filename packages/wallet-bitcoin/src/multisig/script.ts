import { bitcoin } from '../bitcoin-core'
import { sortPubkeysBip67 } from './bip67'
import { ClassicMultisigError, CLASSIC_MULTISIG_MAX_N, WSH_CHECKMULTISIG_MAX_N } from './types'

export type SortedMultiPayment = {
  address: string
  output: Buffer
  witnessScript: Buffer
  redeemScript: Buffer
  p2shAddress: string
  pubkeys: Buffer[]
  k: number
}

export function p2wshSortedMulti(
  k: number,
  pubkeys: Buffer[],
  network: bitcoin.Network = bitcoin.networks.bitcoin
): SortedMultiPayment {
  if (!Number.isInteger(k) || k < 1) {
    throw new ClassicMultisigError('Invalid threshold k', 'BAD_THRESHOLD')
  }
  if (pubkeys.length < k) {
    throw new ClassicMultisigError('k cannot exceed n', 'BAD_THRESHOLD')
  }
  if (pubkeys.length < 2) {
    throw new ClassicMultisigError('Need at least 2 keys for classic multisig', 'BAD_N')
  }
  if (pubkeys.length > CLASSIC_MULTISIG_MAX_N) {
    throw new ClassicMultisigError(
      `v1 n cap is ${CLASSIC_MULTISIG_MAX_N} (wsh consensus/standardness allows ${WSH_CHECKMULTISIG_MAX_N})`,
      'N_TOO_LARGE'
    )
  }

  const sorted = sortPubkeysBip67(pubkeys)
  const unique = new Set(sorted.map((p) => p.toString('hex')))
  if (unique.size !== sorted.length) {
    throw new ClassicMultisigError(
      'Duplicate pubkeys silently lower the effective threshold',
      'DUPLICATE_KEY'
    )
  }
  const p2ms = bitcoin.payments.p2ms({
    m: k,
    pubkeys: sorted,
    network
  })
  if (!p2ms.output) {
    throw new ClassicMultisigError('p2ms script failed', 'SCRIPT')
  }
  const p2wsh = bitcoin.payments.p2wsh({
    redeem: p2ms,
    network
  })
  const p2sh = bitcoin.payments.p2sh({
    redeem: p2ms,
    network
  })
  if (!p2wsh.address || !p2wsh.output || !p2sh.address) {
    throw new ClassicMultisigError('p2wsh payment failed', 'SCRIPT')
  }
  return {
    address: p2wsh.address,
    output: p2wsh.output,
    witnessScript: p2ms.output,
    redeemScript: p2ms.output,
    p2shAddress: p2sh.address,
    pubkeys: sorted,
    k
  }
}
