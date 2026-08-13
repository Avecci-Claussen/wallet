import { BigNumber } from 'bignumber.js'

export function amountToSatoshis(val: any) {
  const num = new BigNumber(val)
  return num.multipliedBy(100000000).toNumber()
}

export function sumBitcoinBalanceV2(
  parts: Array<{ availableBalance: number; unavailableBalance: number; totalBalance: number }>
) {
  return parts.reduce(
    (acc, p) => ({
      availableBalance: acc.availableBalance + p.availableBalance,
      unavailableBalance: acc.unavailableBalance + p.unavailableBalance,
      totalBalance: acc.totalBalance + p.totalBalance,
    }),
    { availableBalance: 0, unavailableBalance: 0, totalBalance: 0 }
  )
}

export function addBtcAmountStrings(amounts: string[]): string {
  return amounts
    .reduce((n, a) => n.plus(new BigNumber(a || 0)), new BigNumber(0))
    .toFixed(8)
}
