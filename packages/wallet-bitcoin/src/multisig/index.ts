export { descriptorChecksum, verifyDescriptorChecksum, withChecksum } from './checksum'
export { sortPubkeysBip67, assertCompressedPubkey } from './bip67'
export { p2wshSortedMulti } from './script'
export type { SortedMultiPayment } from './script'
export { bip48AccountPath, bip48OriginPath, normalizeFingerprint } from './bip48'
export {
  encodeSortedMultiDescriptor,
  encodeSortedMultiDescriptorPair,
  parseSortedMultiDescriptor,
  parseCosignerLine,
  parseCosignerLines,
  formatCosignerLine,
  addressesMustMatch
} from './descriptor'
export {
  buildSortedMultiSpendPsbt,
  estimateP2wshMofNVbytes,
  summarizeSortedMultiPsbt,
  assertP2wshSpendShape
} from './spend'
export type { SortedMultiSpendUtxo, SortedMultiPsbtSummary } from './spend'
export { assertSafeSighash, assertP2wshUtxoMatchesWitnessScript, combineAndFinalize } from './psbt'
export {
  ClassicMultisigError,
  CLASSIC_MULTISIG_MAX_N,
  CLASSIC_MULTISIG_GAP,
  WSH_CHECKMULTISIG_MAX_N,
  BIP48_P2WSH_SCRIPT_TYPE
} from './types'
export type { CosignerXpub, ParsedSortedMulti, ClassicMultisigNetwork } from './types'
