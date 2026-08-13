export const CLASSIC_MULTISIG_MAX_N = 7
export const WSH_CHECKMULTISIG_MAX_N = 20
export const CLASSIC_MULTISIG_GAP = 20
export const BIP48_P2WSH_SCRIPT_TYPE = 2

export type ClassicMultisigNetwork = 'mainnet' | 'testnet' | 'regtest'

export type CosignerXpub = {
  fingerprint: string
  /** BIP32 origin after fingerprint, e.g. 48h/0h/0h/2h */
  originPath: string
  xpub: string
}

export type ParsedSortedMulti = {
  k: number
  n: number
  network: ClassicMultisigNetwork
  chain: 0 | 1
  cosigners: CosignerXpub[]
  body: string
  checksum: string
  raw: string
}

export class ClassicMultisigError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'ClassicMultisigError'
    this.code = code
  }
}
