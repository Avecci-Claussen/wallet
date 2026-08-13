import { withChecksum, verifyDescriptorChecksum } from './checksum'
import { bip48OriginPath, normalizeFingerprint } from './bip48'
import {
  ClassicMultisigError,
  ClassicMultisigNetwork,
  CosignerXpub,
  ParsedSortedMulti,
  CLASSIC_MULTISIG_MAX_N
} from './types'

const XPUB_RE = /^[xt]pub[A-Za-z0-9]{107}$/
const PRIV_RE = /[xtuvyz]prv/i
const SLIP132_RE = /^[yzYZuv]pub/
const BIP48_ORIGIN_RE = /^48h\/([01]h)\/(\d+)h\/2h$/
/** Origin + chain required. Optional groups would accept checksummed-but-incomplete keys. */
const KEY_ONE_RE =
  /^\[([0-9a-fA-F]{8})\/([0-9hH'\/]+)\]([xt]pub[A-Za-z0-9]{107})\/([01])\/\*$/

function networkOfXpub(xpub: string): ClassicMultisigNetwork {
  if (xpub.startsWith('xpub')) return 'mainnet'
  if (xpub.startsWith('tpub')) return 'testnet'
  throw new ClassicMultisigError('Unsupported extended key prefix', 'BAD_XPUB')
}

function assertXpub(xpub: string): void {
  if (PRIV_RE.test(xpub)) {
    throw new ClassicMultisigError('Private keys are forbidden in the descriptor', 'PRIVATE_KEY')
  }
  if (SLIP132_RE.test(xpub)) {
    throw new ClassicMultisigError(
      'SLIP-132 ypub/zpub/Ypub/Zpub are not BIP380 keys; use xpub/tpub',
      'SLIP132'
    )
  }
  if (!XPUB_RE.test(xpub)) {
    throw new ClassicMultisigError('Expected compressed-account xpub/tpub', 'BAD_XPUB')
  }
}

function assertBip48Origin(originPath: string, network: ClassicMultisigNetwork): void {
  const p = originPath.replace(/'/g, 'h').replace(/H/g, 'h')
  const m = BIP48_ORIGIN_RE.exec(p)
  const coin = network === 'mainnet' ? '0h' : '1h'
  if (!m || m[1] !== coin) {
    throw new ClassicMultisigError(
      `Origin must be BIP48 P2WSH ${bip48OriginPath(network === 'mainnet' ? 'mainnet' : 'testnet')}`,
      'BAD_PATH'
    )
  }
}

function assertUniqueXpubs(cosigners: CosignerXpub[]): void {
  const seen = new Set<string>()
  for (const c of cosigners) {
    if (seen.has(c.xpub)) {
      throw new ClassicMultisigError(
        'Duplicate xpub silently lowers the effective threshold',
        'DUPLICATE_KEY'
      )
    }
    seen.add(c.xpub)
  }
}

function canonicalize(cosigners: CosignerXpub[]): CosignerXpub[] {
  return [...cosigners].sort((a, b) => {
    const fp = a.fingerprint.localeCompare(b.fingerprint)
    return fp !== 0 ? fp : a.xpub.localeCompare(b.xpub)
  })
}

function keyExpr(c: CosignerXpub, chain: 0 | 1): string {
  return `[${c.fingerprint}/${c.originPath}]${c.xpub}/${chain}/*`
}

export function encodeSortedMultiDescriptor(opts: {
  k: number
  cosigners: CosignerXpub[]
  chain: 0 | 1
}): string {
  const { k, chain } = opts
  if (!Number.isInteger(k) || k < 1 || k > opts.cosigners.length) {
    throw new ClassicMultisigError('Invalid k-of-n', 'BAD_THRESHOLD')
  }
  if (opts.cosigners.length < 2) {
    throw new ClassicMultisigError('Need at least 2 cosigners', 'BAD_N')
  }
  if (opts.cosigners.length > CLASSIC_MULTISIG_MAX_N) {
    throw new ClassicMultisigError('v1 n cap exceeded', 'N_TOO_LARGE')
  }
  const cosigners = canonicalize(
    opts.cosigners.map((c) => ({
      fingerprint: normalizeFingerprint(c.fingerprint),
      originPath: c.originPath.replace(/'/g, 'h'),
      xpub: c.xpub
    }))
  )
  assertUniqueXpubs(cosigners)
  for (const c of cosigners) assertXpub(c.xpub)
  const nets = new Set(cosigners.map((c) => networkOfXpub(c.xpub)))
  if (nets.size !== 1) {
    throw new ClassicMultisigError('Do not mix xpub and tpub', 'NETWORK_MIX')
  }
  const network = [...nets][0]!
  for (const c of cosigners) assertBip48Origin(c.originPath, network)
  const keys = cosigners.map((c) => keyExpr(c, chain)).join(',')
  return withChecksum(`wsh(sortedmulti(${k},${keys}))`)
}

export function encodeSortedMultiDescriptorPair(opts: {
  k: number
  cosigners: CosignerXpub[]
}): { receive: string; change: string } {
  return {
    receive: encodeSortedMultiDescriptor({ ...opts, chain: 0 }),
    change: encodeSortedMultiDescriptor({ ...opts, chain: 1 })
  }
}

export function parseSortedMultiDescriptor(raw: string): ParsedSortedMulti {
  const trimmed = raw.trim()
  if (PRIV_RE.test(trimmed)) {
    throw new ClassicMultisigError('Private keys are forbidden in the descriptor', 'PRIVATE_KEY')
  }
  if (trimmed.length < 10 || trimmed[trimmed.length - 9] !== '#') {
    throw new ClassicMultisigError('Descriptor missing #checksum', 'MISSING_CHECKSUM')
  }
  if (!verifyDescriptorChecksum(trimmed)) {
    throw new ClassicMultisigError('Descriptor checksum invalid', 'INVALID_CHECKSUM')
  }
  const body = trimmed.slice(0, -9)
  const checksum = trimmed.slice(-8)
  if (
    body.startsWith('sh(') ||
    body.startsWith('tr(') ||
    body.includes('sortedmulti_a') ||
    body.includes('multi_a') ||
    /^wsh\(multi\(/.test(body)
  ) {
    throw new ClassicMultisigError(
      'v1 accepts only wsh(sortedmulti(k,...)) — not multi(), sh(), tr(), or sortedmulti_a',
      'UNSUPPORTED_SCRIPT'
    )
  }
  const m = /^wsh\(sortedmulti\((\d+),(.+)\)\)$/.exec(body)
  if (!m) {
    throw new ClassicMultisigError(
      'v1 accepts only wsh(sortedmulti(k,...))',
      'UNSUPPORTED_SCRIPT'
    )
  }
  const k = Number(m[1])
  const keysBlob = m[2]
  if (!keysBlob) {
    throw new ClassicMultisigError('v1 accepts only wsh(sortedmulti(k,...))', 'UNSUPPORTED_SCRIPT')
  }
  if (keysBlob.includes('<')) {
    throw new ClassicMultisigError('Multipath / taproot multisig is not v1', 'UNSUPPORTED_SCRIPT')
  }

  const cosigners: CosignerXpub[] = []
  let chain: 0 | 1 | undefined
  const keyParts = keysBlob.split(',')
  for (const part of keyParts) {
    const match = KEY_ONE_RE.exec(part.trim())
    if (!match) {
      throw new ClassicMultisigError('Malformed cosigner key expression', 'BAD_KEY')
    }
    const fingerprint = match[1]
    const originPath = match[2]
    const xpub = match[3]
    const chainStr = match[4]
    if (!xpub) {
      throw new ClassicMultisigError('Malformed cosigner key expression', 'BAD_KEY')
    }
    assertXpub(xpub)
    if (!fingerprint || !originPath) {
      throw new ClassicMultisigError('Each key must include [fingerprint/origin]', 'MISSING_ORIGIN')
    }
    const ch = chainStr === '1' ? 1 : 0
    if (chain === undefined) chain = ch
    else if (chain !== ch) {
      throw new ClassicMultisigError('Mixed receive/change in one descriptor', 'MIXED_CHAIN')
    }
    cosigners.push({
      fingerprint: normalizeFingerprint(fingerprint),
      originPath: originPath.replace(/'/g, 'h'),
      xpub
    })
  }
  if (cosigners.length < 2) {
    throw new ClassicMultisigError('Need at least 2 cosigners', 'BAD_N')
  }
  if (k < 1 || k > cosigners.length) {
    throw new ClassicMultisigError('Invalid k-of-n', 'BAD_THRESHOLD')
  }
  assertUniqueXpubs(cosigners)
  const nets = new Set(cosigners.map((c) => networkOfXpub(c.xpub)))
  if (nets.size !== 1) {
    throw new ClassicMultisigError('Do not mix xpub and tpub', 'NETWORK_MIX')
  }
  const network = [...nets][0]
  if (!network) {
    throw new ClassicMultisigError('Do not mix xpub and tpub', 'NETWORK_MIX')
  }
  for (const c of cosigners) {
    assertBip48Origin(c.originPath, network)
  }
  return {
    k,
    n: cosigners.length,
    network,
    chain: chain ?? 0,
    cosigners,
    body,
    checksum,
    raw: trimmed
  }
}

export function addressesMustMatch(local: string, coordinator: string): void {
  if (local !== coordinator) {
    throw new ClassicMultisigError(
      'Address mismatch — do not fund. Re-derive locally; the collector is not the source of truth.',
      'ADDRESS_MISMATCH'
    )
  }
}
