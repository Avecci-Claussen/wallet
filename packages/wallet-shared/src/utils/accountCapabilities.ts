import { KeyringType } from '../constants'
import { Account } from '../types'

export enum AccountSignMethod {
  Local = 'local',
  Keystone = 'keystone',
  ColdWallet = 'coldWallet',
  External = 'external',
  None = 'none',
}

export type AccountCapabilities = {
  canCreateSigningRequest: boolean
  signMethod: AccountSignMethod
  canChangeAddressType: boolean
}

export function getAccountCapabilities(
  account: Pick<Account, 'type'> | { type?: string } | null | undefined
): AccountCapabilities {
  const type = account?.type
  const hasAccountType = Boolean(type)
  const isWatchOnly = type === KeyringType.WatchAddressKeyring
  const isClassicMultisig = type === KeyringType.ClassicMultisigKeyring
  const isReadonly = type === KeyringType.ReadonlyKeyring
  let signMethod = AccountSignMethod.None

  if (type === KeyringType.KeystoneKeyring) {
    signMethod = AccountSignMethod.Keystone
  } else if (type === KeyringType.ColdWalletKeyring) {
    signMethod = AccountSignMethod.ColdWallet
  } else if (isReadonly) {
    signMethod = AccountSignMethod.External
  } else if (hasAccountType && !isWatchOnly && !isClassicMultisig) {
    signMethod = AccountSignMethod.Local
  }

  return {
    canCreateSigningRequest: hasAccountType && !isWatchOnly && !isClassicMultisig,
    signMethod,
    canChangeAddressType:
      hasAccountType &&
      !isWatchOnly &&
      !isClassicMultisig &&
      signMethod !== AccountSignMethod.ColdWallet,
  }
}
