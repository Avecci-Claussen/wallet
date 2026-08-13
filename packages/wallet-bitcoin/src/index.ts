// Bitcoin core exports
export { bitcoin, eccManager } from './bitcoin-core'
export type { ECPairInterface } from './bitcoin-core'

// Address utilities
export * from './address'
// Network utilities
export { toPsbtNetwork, toNetworkType } from './network'

// Utilities
export { toXOnly, tweakSigner, validator, schnorrValidator } from './utils'

// Message signing
export * from './message'

// constants
export { UTXO_DUST } from './constants'

// Classic k-of-n P2WSH (OP_CHECKMULTISIG).
export * from './multisig'
