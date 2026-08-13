import { ClassicMultisigError, ClassicMultisigNetwork, BIP48_P2WSH_SCRIPT_TYPE } from './types'

export function bip48AccountPath(
  network: ClassicMultisigNetwork,
  account = 0
): string {
  if (!Number.isInteger(account) || account < 0) {
    throw new ClassicMultisigError('Invalid BIP48 account', 'BAD_PATH')
  }
  const coin = network === 'mainnet' ? 0 : 1
  return `m/48'/${coin}'/${account}'/${BIP48_P2WSH_SCRIPT_TYPE}'`
}

export function bip48OriginPath(
  network: ClassicMultisigNetwork,
  account = 0
): string {
  const coin = network === 'mainnet' ? 0 : 1
  return `48h/${coin}h/${account}h/${BIP48_P2WSH_SCRIPT_TYPE}h`
}

export function normalizeFingerprint(hex: string): string {
  const h = hex.trim().toLowerCase().replace(/^0x/, '')
  if (!/^[0-9a-f]{8}$/.test(h)) {
    throw new ClassicMultisigError('Fingerprint must be 8 hex chars', 'BAD_FINGERPRINT')
  }
  return h
}
