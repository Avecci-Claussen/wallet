import { describe, expect, it } from 'vitest'

import { KeyringType } from '../src/constants/common'
import { AccountSignMethod, getAccountCapabilities } from '../src/utils/accountCapabilities'

describe('getAccountCapabilities — P2WSH multisig', () => {
  it('cannot use singlesig Send, provider signPsbt, or address-type switch', () => {
    const cap = getAccountCapabilities({ type: KeyringType.ClassicMultisigKeyring })
    expect(cap.canCreateSigningRequest).toBe(false)
    expect(cap.signMethod).toBe(AccountSignMethod.None)
    expect(cap.canChangeAddressType).toBe(false)
  })

  it('HD remains local-sign', () => {
    const cap = getAccountCapabilities({ type: KeyringType.HdKeyring })
    expect(cap.canCreateSigningRequest).toBe(true)
    expect(cap.signMethod).toBe(AccountSignMethod.Local)
  })
})
