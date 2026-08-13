import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { KeyringType } from '@unisat/wallet-shared'
import { AddressType } from '@unisat/wallet-types'

import { useSettingsTabScreenLogic } from '../../src/ui-hooks/useSettingsTabScreenLogic'
import { accountActions } from '../../src/reducers/accounts'
import { keyringsActions } from '../../src/reducers/keyrings'
import { createHookTestHarness } from './testHelpers'

describe('useSettingsTabScreenLogic', () => {
  it('does not throw when the current wallet is P2WSH multisig', () => {
    const { wrapper, store } = createHookTestHarness()
    const account = {
      type: KeyringType.ClassicMultisigKeyring,
      address: 'bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      brandName: 'P2WSH Multisig',
      alianName: 'Multisig 1',
      displayBrandName: 'P2WSH Multisig',
      index: 0,
      balance: 0,
      pubkey: '',
      key: 'account-msig',
      flag: 0,
    }
    store.dispatch(accountActions.setCurrent(account))
    store.dispatch(
      keyringsActions.setCurrent({
        key: 'keyring-msig',
        index: 0,
        type: KeyringType.ClassicMultisigKeyring,
        addressType: AddressType.P2WSH,
        accounts: [account],
        alianName: 'P2WSH Multisig #1',
        hdPath: '',
      })
    )

    const { result } = renderHook(() => useSettingsTabScreenLogic(), { wrapper })
    expect(result.error).toBeUndefined()
    expect(result.current.settings_addressType.value).toBe('Native Segwit (P2WSH)')
    expect(result.current.settings_addressType.right).toBe(false)
  })
})
