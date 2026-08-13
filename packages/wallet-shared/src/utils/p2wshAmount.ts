export type P2wshAmountUnit = 'btc' | 'sats'

const MAX_BTC = 21_000_000

/** Parse the P2WSH Send amount. Unit is explicit so sats cannot be treated as BTC. */
export function p2wshAmountToSats(raw: string, unit: P2wshAmountUnit): number {
  const n = Number(String(raw).trim().replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Amount must be greater than zero')
  }
  if (unit === 'sats') {
    if (!Number.isInteger(n)) {
      throw new Error('Sats must be a whole number')
    }
    return n
  }
  if (n > MAX_BTC) {
    throw new Error('BTC amount exceeds 21 million')
  }
  return Math.round(n * 1e8)
}
