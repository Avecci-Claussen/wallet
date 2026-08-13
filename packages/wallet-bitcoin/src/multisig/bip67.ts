import { ClassicMultisigError } from './types'

const COMPRESSED_PREFIX = new Set([0x02, 0x03])

export function assertCompressedPubkey(pubkey: Buffer): void {
  if (pubkey.length !== 33 || pubkey[0] === undefined || !COMPRESSED_PREFIX.has(pubkey[0])) {
    throw new ClassicMultisigError(
      'Uncompressed or malformed pubkey (BIP67 requires compressed 33-byte keys)',
      'UNCOMPRESSED_KEY'
    )
  }
}

/** Lexicographic sort of compressed pubkeys (unsigned byte order). */
export function sortPubkeysBip67(pubkeys: Buffer[]): Buffer[] {
  for (const pk of pubkeys) assertCompressedPubkey(pk)
  return [...pubkeys].sort((a, b) => a.compare(b))
}
