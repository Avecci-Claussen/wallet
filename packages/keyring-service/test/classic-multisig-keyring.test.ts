import { describe, it, expect, beforeAll } from 'vitest'
import * as bip39 from 'bip39'
import { bitcoin, combineAndFinalize, eccManager, p2wshSortedMulti } from '@unisat/wallet-bitcoin'
import { ClassicMultisigKeyring } from '../src/keyrings/classic-multisig-keyring'

beforeAll(() => {
  eccManager.setEccType(eccManager.eccType)
})

const MNEMONICS = [
  bip39.entropyToMnemonic('00000000000000000000000000000000'),
  bip39.entropyToMnemonic('11111111111111111111111111111111'),
  bip39.entropyToMnemonic('22222222222222222222222222222222')
]

function threeParties(network: 'regtest' = 'regtest') {
  const exporters = MNEMONICS.map(
    (mnemonic) =>
      new ClassicMultisigKeyring({
        mnemonic,
        k: 2,
        cosigners: [],
        network
      })
  )
  const cosigners = exporters.map((k) => k.exportLocalXpub())
  return MNEMONICS.map(
    (mnemonic) =>
      new ClassicMultisigKeyring({
        mnemonic,
        k: 2,
        cosigners,
        network
      })
  )
}

describe('ClassicMultisigKeyring', () => {
  it('three parties independently derive the same address 0', () => {
    const rings = threeParties()
    const a0 = rings.map((r) => r.addressAt(0, 0))
    expect(a0[0]).toBe(a0[1])
    expect(a0[1]).toBe(a0[2])
    expect(a0[0].startsWith('bcrt1q')).toBe(true)
    expect(rings[0].addressAt(1, 0)).not.toBe(a0[0])
    rings[0].verifyCoordinatorAddress(a0[1])
    expect(rings[0].verified).toBe(true)
    expect(() => rings[1].verifyCoordinatorAddress('bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toThrow()
  })

  it('getAccounts is receive chain only; change/0 is a different script', async () => {
    const rings = threeParties()
    const accounts = await rings[0].getAccounts()
    expect(accounts).toEqual([rings[0].addressAt(0, 0)])
    expect(rings[0].addressAt(1, 0)).not.toBe(accounts[0])
  })

  it('2-of-3 sign + combine extracts a tx', async () => {
    const rings = threeParties()
    const pay = rings[0].paymentAt(0, 0)
    for (const r of rings) r.verifyCoordinatorAddress(pay.address)

    const build = () => {
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest })
      psbt.setVersion(2)
      psbt.addInput({
        hash: Buffer.alloc(32, 2),
        index: 0,
        sequence: 0xfffffffd,
        witnessUtxo: { script: pay.output, value: 100000 },
        witnessScript: pay.witnessScript,
        sighashType: bitcoin.Transaction.SIGHASH_ALL
      })
      psbt.addOutput({ script: pay.output, value: 90000 })
      return psbt
    }

    const a = build()
    await rings[0].signTransaction(a, [{ index: 0, publicKey: rings[0].exportLocalXpub().xpub }])
    const b = build()
    await rings[1].signTransaction(b, [{ index: 0, publicKey: rings[1].exportLocalXpub().xpub }])
    const tx = combineAndFinalize([a, b])
    expect(tx.ins.length).toBe(1)
    expect(tx.outs[0].value).toBe(90000)
  })

  it('exports tpub on regtest and descriptors() checksums', () => {
    const rings = threeParties()
    const x = rings[0].exportLocalXpub()
    expect(x.xpub.startsWith('tpub')).toBe(true)
    expect(x.originPath).toBe('48h/1h/0h/2h')
    const pair = rings[0].descriptors()
    expect(pair.receive.startsWith('wsh(sortedmulti(2,')).toBe(true)
    expect(pair.receive).toMatch(/#[a-z0-9]{8}$/)
    expect(pair.change).not.toBe(pair.receive)
  })

  it('refuses SIGHASH_NONE even when passed only in ToSignInput', async () => {
    const rings = threeParties()
    const pay = rings[0].paymentAt(0, 0)
    for (const r of rings) r.verifyCoordinatorAddress(pay.address)
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest })
    psbt.addInput({
      hash: Buffer.alloc(32, 6),
      index: 0,
      witnessUtxo: { script: pay.output, value: 100000 },
      witnessScript: pay.witnessScript,
      sighashType: bitcoin.Transaction.SIGHASH_ALL
    })
    psbt.addOutput({ script: pay.output, value: 90000 })
    await expect(
      rings[0].signTransaction(psbt, [
        { index: 0, publicKey: '', sighashTypes: [bitcoin.Transaction.SIGHASH_NONE] }
      ])
    ).rejects.toThrow(/SIGHASH/)
  })

  it('refuses export of private keys', async () => {
    const rings = threeParties()
    await expect(rings[0].exportAccount()).rejects.toThrow(/private key/)
  })

  it('refuses sign before address-match and watch-only sign', async () => {
    const rings = threeParties()
    const pay = rings[0].paymentAt(0, 0)
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest })
    psbt.addInput({
      hash: Buffer.alloc(32, 4),
      index: 0,
      witnessUtxo: { script: pay.output, value: 100000 },
      witnessScript: pay.witnessScript,
      sighashType: bitcoin.Transaction.SIGHASH_ALL
    })
    psbt.addOutput({ script: pay.output, value: 90000 })
    await expect(
      rings[0].signTransaction(psbt, [{ index: 0, publicKey: '' }])
    ).rejects.toThrow(/match gate/)

    const watch = new ClassicMultisigKeyring({
      k: 2,
      cosigners: rings[0].cosigners,
      network: 'regtest'
    })
    watch.verifyCoordinatorAddress(pay.address)
    await expect(
      watch.signTransaction(psbt, [{ index: 0, publicKey: '' }])
    ).rejects.toThrow(/Watch-only/)
  })

  it('refuses a foreign script even when the UTXO is well-formed P2WSH', async () => {
    const rings = threeParties()
    const vault = rings[0].paymentAt(0, 0)
    for (const r of rings) r.verifyCoordinatorAddress(vault.address)
    const a = eccManager.eccPair.makeRandom({ compressed: true })
    const b = eccManager.eccPair.makeRandom({ compressed: true })
    const decoy = p2wshSortedMulti(2, [a.publicKey, b.publicKey], bitcoin.networks.regtest)
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest })
    psbt.addInput({
      hash: Buffer.alloc(32, 5),
      index: 0,
      witnessUtxo: { script: decoy.output, value: 100000 },
      witnessScript: decoy.witnessScript,
      sighashType: bitcoin.Transaction.SIGHASH_ALL
    })
    psbt.addOutput({ script: decoy.output, value: 90000 })
    await expect(
      rings[0].signTransaction(psbt, [{ index: 0, publicKey: '' }])
    ).rejects.toThrow(/not in this input/)
  })

  it('refuses a cosigner set that does not include this seed', () => {
    const rings = threeParties()
    const outsider = bip39.entropyToMnemonic('33333333333333333333333333333333')
    expect(
      () =>
        new ClassicMultisigKeyring({
          mnemonic: outsider,
          k: 2,
          cosigners: rings[0].cosigners,
          network: 'regtest'
        })
    ).toThrow(/not in the cosigner set/)
  })

  it('re-checks address match when deserializing verified=true', async () => {
    const rings = threeParties()
    const addr = rings[0].addressAt(0, 0)
    rings[0].verifyCoordinatorAddress(addr)
    const ser = await rings[0].serialize()
    expect(
      () =>
        new ClassicMultisigKeyring({
          ...ser,
          coordinatorAddress0: 'bcrt1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'
        })
    ).toThrow(/mismatch/)
  })
})
