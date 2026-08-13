import { describe, expect, it } from 'vitest'

import { p2wshAmountToSats } from '../src/utils/p2wshAmount'

describe('p2wshAmountToSats', () => {
  it('treats BTC as 1e8 sats', () => {
    expect(p2wshAmountToSats('0.00010000', 'btc')).toBe(10000)
    expect(p2wshAmountToSats('1', 'btc')).toBe(100000000)
  })

  it('does not multiply when unit is sats', () => {
    expect(p2wshAmountToSats('10000', 'sats')).toBe(10000)
  })

  it('refuses zero, empty, and sats with a fraction', () => {
    expect(() => p2wshAmountToSats('', 'btc')).toThrow(/greater than zero/)
    expect(() => p2wshAmountToSats('0', 'sats')).toThrow(/greater than zero/)
    expect(() => p2wshAmountToSats('1.5', 'sats')).toThrow(/whole number/)
  })

  it('refuses more than 21 million BTC', () => {
    expect(() => p2wshAmountToSats('21000001', 'btc')).toThrow(/21 million/)
  })
})
