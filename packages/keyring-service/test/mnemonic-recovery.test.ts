import { describe, expect, it, vi } from 'vitest'

import { KeyringService, SimpleEncryptor, normalizeMnemonic } from '../src'
import { AddressType } from '@unisat/wallet-types'

const mnemonic =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

function createService() {
  const storage = {
    get: vi.fn().mockResolvedValue({ booted: '', vault: null, boostValue: 'true' }),
    set: vi.fn().mockResolvedValue(undefined),
  }
  const service = new KeyringService()

  return {
    service,
    init: async () => {
      await service.init({
        storage: storage as any,
        encryptor: new SimpleEncryptor(),
        logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
        t: (key: string) => key,
      })
      await service.boot('test-password')
    },
  }
}

describe('mnemonic recovery input', () => {
  it('normalizes whitespace and persists the canonical BIP-39 phrase', async () => {
    const { service, init } = createService()
    await init()

    const keyring = await service.createKeyringWithMnemonics(
      `  ${mnemonic.replace('abandon abandon', 'abandon\nabandon')}  `,
      "m/84'/0'/0'/0",
      '',
      AddressType.P2WPKH,
      1
    )

    expect(normalizeMnemonic(`\t${mnemonic}\n`)).toBe(mnemonic)
    const serialized = (await keyring.serialize()) as { mnemonic: string }
    expect(serialized.mnemonic).toBe(mnemonic)
  })

  it('rejects malformed derivation paths before creating a persistent keyring', async () => {
    const { service, init } = createService()
    await init()

    await expect(
      service.createKeyringWithMnemonics(mnemonic, 'm/84/not-a-number', '', AddressType.P2WPKH, 1)
    ).rejects.toThrow('invalid_derivation_path')
    expect(service.keyrings).toHaveLength(0)
  })

  it('rejects unsafe account counts before deriving accounts', async () => {
    const { service, init } = createService()
    await init()

    await expect(
      service.createKeyringWithMnemonics(mnemonic, "m/84'/0'/0'/0", '', AddressType.P2WPKH, 101)
    ).rejects.toThrow('keyring_error_account_count')
    expect(service.keyrings).toHaveLength(0)
  })
})
