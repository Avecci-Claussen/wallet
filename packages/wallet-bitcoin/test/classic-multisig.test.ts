import { describe, it, expect, beforeAll } from 'vitest'
import { bitcoin, eccManager } from '../src/bitcoin-core'
import {
  sortPubkeysBip67,
  p2wshSortedMulti,
  descriptorChecksum,
  verifyDescriptorChecksum,
  withChecksum,
  encodeSortedMultiDescriptor,
  encodeSortedMultiDescriptorPair,
  parseSortedMultiDescriptor,
  parseCosignerLine,
  parseCosignerLines,
  formatCosignerLine,
  buildSortedMultiSpendPsbt,
  summarizeSortedMultiPsbt,
  assertP2wshSpendShape,
  addressesMustMatch,
  assertSafeSighash,
  assertP2wshUtxoMatchesWitnessScript,
  combineAndFinalize,
  ClassicMultisigError,
  CosignerXpub
} from '../src/multisig'

beforeAll(() => {
  eccManager.setEccType(eccManager.eccType)
})

describe('BIP-380 checksum', () => {
  it('matches the BIP raw() vector', () => {
    expect(descriptorChecksum('raw(deadbeef)')).toBe('89f8spxm')
    expect(verifyDescriptorChecksum('raw(deadbeef)#89f8spxm')).toBe(true)
    expect(verifyDescriptorChecksum('raw(deadbeef)#00000000')).toBe(false)
  })
})

describe('BIP67 sort + scripts', () => {
  it('vector 1: 2-of-2', () => {
    const list = [
      Buffer.from('02ff12471208c14bd580709cb2358d98975247d8765f92bc25eab3b2763ed605f8', 'hex'),
      Buffer.from('02fe6f0a5a297eb38c391581c4413e084773ea23954d93f7753db7dc0adc188b2f', 'hex')
    ]
    const sorted = sortPubkeysBip67(list)
    expect(sorted[0].toString('hex')).toBe(
      '02fe6f0a5a297eb38c391581c4413e084773ea23954d93f7753db7dc0adc188b2f'
    )
    const pay = p2wshSortedMulti(2, list)
    expect(pay.witnessScript.toString('hex')).toBe(
      '522102fe6f0a5a297eb38c391581c4413e084773ea23954d93f7753db7dc0adc188b2f2102ff12471208c14bd580709cb2358d98975247d8765f92bc25eab3b2763ed605f852ae'
    )
    expect(pay.p2shAddress).toBe('39bgKC7RFbpoCRbtD5KEdkYKtNyhpsNa3Z')
    expect(pay.address.startsWith('bc1q')).toBe(true)
  })

  it('vector 4: order-independent (bitcore)', () => {
    const a = Buffer.from('022df8750480ad5b26950b25c7ba79d3e37d75f640f8e5d9bcd5b150a0f85014da', 'hex')
    const b = Buffer.from('03e3818b65bcc73a7d64064106a859cc1a5a728c4345ff0b641209fba0d90de6e9', 'hex')
    const c = Buffer.from('021f2f6e1e50cb6a953935c3601284925decd3fd21bc445712576873fb8c6ebc18', 'hex')
    const p1 = p2wshSortedMulti(2, [a, b, c])
    const p2 = p2wshSortedMulti(2, [c, a, b])
    expect(p1.address).toBe(p2.address)
    expect(p1.p2shAddress).toBe('3Q4sF6tv9wsdqu2NtARzNCpQgwifm2rAba')
    expect(p1.witnessScript.toString('hex')).toBe(
      '5221021f2f6e1e50cb6a953935c3601284925decd3fd21bc445712576873fb8c6ebc1821022df8750480ad5b26950b25c7ba79d3e37d75f640f8e5d9bcd5b150a0f85014da2103e3818b65bcc73a7d64064106a859cc1a5a728c4345ff0b641209fba0d90de6e953ae'
    )
  })

  it('rejects uncompressed keys', () => {
    const uncompressed = Buffer.concat([Buffer.from([0x04]), Buffer.alloc(64, 1)])
    const compressed = Buffer.from(
      '02fe6f0a5a297eb38c391581c4413e084773ea23954d93f7753db7dc0adc188b2f',
      'hex'
    )
    expect(() => p2wshSortedMulti(2, [uncompressed, compressed])).toThrow(ClassicMultisigError)
    expect(() => p2wshSortedMulti(1, [compressed])).toThrow(/at least 2/)
    expect(() => p2wshSortedMulti(2, [compressed, compressed])).toThrow(/Duplicate/)
    expect(() => p2wshSortedMulti(0, [compressed, compressed])).toThrow()
    const eight = Array.from({ length: 8 }, () =>
      eccManager.eccPair.makeRandom({ compressed: true }).publicKey
    )
    expect(() => p2wshSortedMulti(2, eight)).toThrow(/n cap/)
  })
})

const COSIGNERS: CosignerXpub[] = [
  {
    fingerprint: 'aaaaaaaa',
    originPath: '48h/0h/0h/2h',
    xpub: 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1OGMLSy4'
  },
  {
    fingerprint: 'bbbbbbbb',
    originPath: '48h/0h/0h/2h',
    xpub: 'xpub661MyMwAqRbcFW31YEwpkMuc5THy2PSt5bDMsktWQcFF8syAmRUapSCGu8ED9W6oDMSgv6Zz8idoc4a6mr8BDzTJY47LJhkJ8UB7WEGuduB'
  },
  {
    fingerprint: 'cccccccc',
    originPath: '48h/0h/0h/2h',
    xpub: 'xpub69H7F5d8KSRgmmdJg2KhpAK8SR3DjMwAdkxj3ZuxV27CprR9LgpeyGmXUbC6wb7ERfvrnKZjXoUmmDznezpbZb7ap6r1D3tgFxHmwMkQTPH'
  }
]

describe('wsh(sortedmulti) descriptor', () => {
  it('round-trips with checksum; xpub order does not change canonical string', () => {
    const a = encodeSortedMultiDescriptor({ k: 2, cosigners: COSIGNERS, chain: 0 })
    const b = encodeSortedMultiDescriptor({
      k: 2,
      cosigners: [COSIGNERS[2], COSIGNERS[0], COSIGNERS[1]],
      chain: 0
    })
    expect(a).toBe(b)
    expect(verifyDescriptorChecksum(a)).toBe(true)
    const parsed = parseSortedMultiDescriptor(a)
    expect(parsed.k).toBe(2)
    expect(parsed.n).toBe(3)
    expect(parsed.chain).toBe(0)
    expect(parsed.network).toBe('mainnet')
  })

  it('receive vs change are different descriptors', () => {
    const pair = encodeSortedMultiDescriptorPair({ k: 2, cosigners: COSIGNERS })
    expect(parseSortedMultiDescriptor(pair.receive).chain).toBe(0)
    expect(parseSortedMultiDescriptor(pair.change).chain).toBe(1)
    expect(pair.receive).not.toBe(pair.change)
  })

  it('rejects xprv, missing checksum, unsorted multi(), mixed networks', () => {
    expect(() => parseSortedMultiDescriptor('wsh(sortedmulti(2,xprv...))')).toThrow()
    const body = encodeSortedMultiDescriptor({ k: 2, cosigners: COSIGNERS, chain: 0 }).slice(0, -9)
    expect(() => parseSortedMultiDescriptor(body)).toThrow()
    const mixed = [
      COSIGNERS[0],
      {
        ...COSIGNERS[1],
        xpub: 'tpubD6NzVbkrYhZ4XgiXtGrdW5XDAPFCL9h7we1vwNCpn8tqbqhcSZ8QdzNVsCkwn5kS3GzEh5zQ2Q5xQ5xQ5xQ5xQ5xQ5xQ5xQ5xQ5xQ5xQ'
      }
    ]
    expect(() => encodeSortedMultiDescriptor({ k: 2, cosigners: mixed as CosignerXpub[], chain: 0 })).toThrow()
    expect(() => encodeSortedMultiDescriptor({ k: 0, cosigners: COSIGNERS, chain: 0 })).toThrow(/k-of-n/)
    expect(() =>
      encodeSortedMultiDescriptor({ k: 2, cosigners: [COSIGNERS[0], COSIGNERS[0]], chain: 0 })
    ).toThrow(/Duplicate/)
    expect(() =>
      encodeSortedMultiDescriptor({
        k: 2,
        cosigners: [
          { ...COSIGNERS[0], originPath: '84h/0h/0h/0h' },
          COSIGNERS[1]
        ],
        chain: 0
      })
    ).toThrow(/BIP48/)
    expect(() =>
      encodeSortedMultiDescriptor({
        k: 2,
        cosigners: [
          { ...COSIGNERS[0], xpub: 'ypub' + 'A'.repeat(107) },
          COSIGNERS[1]
        ],
        chain: 0
      })
    ).toThrow(/SLIP-132/)
  })

  it('rejects unsorted multi(), sh(), tr(), bit-flipped checksum, missing origin', () => {
    const good = encodeSortedMultiDescriptor({ k: 2, cosigners: COSIGNERS, chain: 0 })
    const wshBody = good.slice(0, -9)
    expect(() =>
      parseSortedMultiDescriptor(withChecksum(wshBody.replace('sortedmulti', 'multi')))
    ).toThrow(/sortedmulti/)
    expect(() => parseSortedMultiDescriptor(withChecksum(wshBody.slice(1)))).toThrow(/sortedmulti/)
    expect(() => parseSortedMultiDescriptor(withChecksum('tr(sortedmulti_a(2,pk))'))).toThrow()
    const flipped = good.slice(0, -1) + (good.endsWith('m') ? 'n' : 'm')
    expect(() => parseSortedMultiDescriptor(flipped)).toThrow(/checksum/)
    const noOrigin = withChecksum(
      `wsh(sortedmulti(2,${COSIGNERS[0].xpub}/0/*,${COSIGNERS[1].xpub}/0/*))`
    )
    expect(() => parseSortedMultiDescriptor(noOrigin)).toThrow()
  })

  it('address match gate', () => {
    expect(() => addressesMustMatch('bc1qabc', 'bc1qxyz')).toThrow(/mismatch/)
    expect(() => addressesMustMatch('bc1qabc', 'bc1qabc')).not.toThrow()
  })
})

describe('PSBT 2-of-3 sign/combine/finalize', () => {
  it('two signers can extract a tx; SIGHASH_NONE is refused', () => {
    const alice = eccManager.eccPair.makeRandom({ compressed: true })
    const bob = eccManager.eccPair.makeRandom({ compressed: true })
    const carol = eccManager.eccPair.makeRandom({ compressed: true })
    const pay = p2wshSortedMulti(2, [alice.publicKey, bob.publicKey, carol.publicKey], bitcoin.networks.regtest)

    const build = () => {
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest })
      psbt.setVersion(2)
      psbt.addInput({
        hash: Buffer.alloc(32, 1),
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
    a.signInput(0, alice)
    const b = build()
    b.signInput(0, bob)
    const tx = combineAndFinalize([a, b])
    expect(tx.ins.length).toBe(1)
    expect(tx.outs.length).toBe(1)

    expect(() => assertSafeSighash(bitcoin.Transaction.SIGHASH_NONE)).toThrow(/SIGHASH/)
    expect(() =>
      assertSafeSighash(bitcoin.Transaction.SIGHASH_ALL | bitcoin.Transaction.SIGHASH_ANYONECANPAY)
    ).toThrow(/SIGHASH/)
    expect(() => assertSafeSighash(bitcoin.Transaction.SIGHASH_SINGLE)).toThrow(/SIGHASH/)
    expect(() => assertSafeSighash(undefined)).not.toThrow()
    expect(tx.ins[0].witness[0].length).toBe(0)
  })

  it('refuses a 2-of-3 with only one signature', () => {
    const alice = eccManager.eccPair.makeRandom({ compressed: true })
    const bob = eccManager.eccPair.makeRandom({ compressed: true })
    const carol = eccManager.eccPair.makeRandom({ compressed: true })
    const pay = p2wshSortedMulti(2, [alice.publicKey, bob.publicKey, carol.publicKey], bitcoin.networks.regtest)
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest })
    psbt.addInput({
      hash: Buffer.alloc(32, 3),
      index: 0,
      witnessUtxo: { script: pay.output, value: 100000 },
      witnessScript: pay.witnessScript,
      sighashType: bitcoin.Transaction.SIGHASH_ALL
    })
    psbt.addOutput({ script: pay.output, value: 90000 })
    psbt.signInput(0, alice)
    expect(() => combineAndFinalize([psbt])).toThrow()
  })

  it('refuses witnessScript unbound from witnessUtxo', () => {
    const alice = eccManager.eccPair.makeRandom({ compressed: true })
    const bob = eccManager.eccPair.makeRandom({ compressed: true })
    const vault = p2wshSortedMulti(2, [alice.publicKey, bob.publicKey], bitcoin.networks.regtest)
    const decoy = p2wshSortedMulti(
      2,
      [alice.publicKey, eccManager.eccPair.makeRandom({ compressed: true }).publicKey],
      bitcoin.networks.regtest
    )
    expect(() =>
      assertP2wshUtxoMatchesWitnessScript({ script: vault.output }, decoy.witnessScript)
    ).toThrow(/SHA256/)
    expect(() =>
      assertP2wshUtxoMatchesWitnessScript({ script: vault.output }, vault.witnessScript)
    ).not.toThrow()
  })
})

describe('cosigner bulletin lines', () => {
  it('round-trips formatCosignerLine / parseCosignerLine', () => {
    const line = formatCosignerLine(COSIGNERS[0])
    expect(parseCosignerLine(line)).toEqual({
      fingerprint: 'aaaaaaaa',
      originPath: '48h/0h/0h/2h',
      xpub: COSIGNERS[0].xpub
    })
    const parsed = parseCosignerLines(COSIGNERS.map(formatCosignerLine).join('\n'))
    const pair = encodeSortedMultiDescriptorPair({ k: 2, cosigners: parsed })
    expect(pair.receive).toBe(encodeSortedMultiDescriptor({ k: 2, cosigners: COSIGNERS, chain: 0 }))
  })

  it('rejects a BIP84 origin on a bulletin line', () => {
    expect(() =>
      parseCosignerLine(`[aaaaaaaa/84h/0h/0h]${COSIGNERS[0].xpub}`)
    ).toThrow(/BIP48/)
  })

  it('refuses an xpub line in the descriptor parser', () => {
    expect(() => parseSortedMultiDescriptor(formatCosignerLine(COSIGNERS[0]))).toThrow(
      /xpub line, not a receive descriptor/
    )
  })
})

describe('P2WSH spend PSBT', () => {
  it('builds SIGHASH_ALL inputs and change to a different address', () => {
    const a = eccManager.eccPair.makeRandom({ compressed: true })
    const b = eccManager.eccPair.makeRandom({ compressed: true })
    const vault = p2wshSortedMulti(2, [a.publicKey, b.publicKey], bitcoin.networks.regtest)
    const dest = p2wshSortedMulti(
      2,
      [a.publicKey, eccManager.eccPair.makeRandom({ compressed: true }).publicKey],
      bitcoin.networks.regtest
    )
    const { psbt, change } = buildSortedMultiSpendPsbt({
      network: bitcoin.networks.regtest,
      utxos: [
        {
          txid: Buffer.alloc(32, 9).toString('hex'),
          vout: 0,
          value: 100000,
          script: vault.output,
          witnessScript: vault.witnessScript
        }
      ],
      toAddress: dest.address,
      send: 50000,
      changeAddress: vault.address,
      feeRate: 1,
      k: 2,
      n: 2
    })
    expect(psbt.data.inputs[0].sighashType).toBe(bitcoin.Transaction.SIGHASH_ALL)
    expect(change).toBeGreaterThan(0)
    const summary = summarizeSortedMultiPsbt(psbt, new Set([vault.address]), bitcoin.networks.regtest)
    expect(summary.sighash).toBe('SIGHASH_ALL')
    expect(summary.send).toBe(50000)
    expect(summary.outputs.some((o) => o.isChange)).toBe(true)
    expect(() => assertP2wshSpendShape(summary)).not.toThrow()
  })

  it('refuses destination equal to change', () => {
    const a = eccManager.eccPair.makeRandom({ compressed: true })
    const b = eccManager.eccPair.makeRandom({ compressed: true })
    const vault = p2wshSortedMulti(2, [a.publicKey, b.publicKey], bitcoin.networks.regtest)
    expect(() =>
      buildSortedMultiSpendPsbt({
        network: bitcoin.networks.regtest,
        utxos: [
          {
            txid: Buffer.alloc(32, 9).toString('hex'),
            vout: 0,
            value: 100000,
            script: vault.output,
            witnessScript: vault.witnessScript
          }
        ],
        toAddress: vault.address,
        send: 50000,
        changeAddress: vault.address,
        feeRate: 1,
        k: 2,
        n: 2
      })
    ).toThrow(/change/)
  })

  it('refuses a second external output tagged as payment', () => {
    const a = eccManager.eccPair.makeRandom({ compressed: true })
    const b = eccManager.eccPair.makeRandom({ compressed: true })
    const vault = p2wshSortedMulti(2, [a.publicKey, b.publicKey], bitcoin.networks.regtest)
    const dest = p2wshSortedMulti(
      2,
      [a.publicKey, eccManager.eccPair.makeRandom({ compressed: true }).publicKey],
      bitcoin.networks.regtest
    )
    const thief = p2wshSortedMulti(
      2,
      [b.publicKey, eccManager.eccPair.makeRandom({ compressed: true }).publicKey],
      bitcoin.networks.regtest
    )
    const { psbt } = buildSortedMultiSpendPsbt({
      network: bitcoin.networks.regtest,
      utxos: [
        {
          txid: Buffer.alloc(32, 9).toString('hex'),
          vout: 0,
          value: 100000,
          script: vault.output,
          witnessScript: vault.witnessScript
        }
      ],
      toAddress: dest.address,
      send: 40000,
      changeAddress: vault.address,
      feeRate: 1,
      k: 2,
      n: 2
    })
    psbt.addOutput({ address: thief.address, value: 1000 })
    const summary = summarizeSortedMultiPsbt(psbt, new Set([vault.address]), bitcoin.networks.regtest)
    expect(() => assertP2wshSpendShape(summary)).toThrow(/exactly one payment/)
  })

  it('refuses an OP_RETURN-only output as the payment', () => {
    const a = eccManager.eccPair.makeRandom({ compressed: true })
    const b = eccManager.eccPair.makeRandom({ compressed: true })
    const vault = p2wshSortedMulti(2, [a.publicKey, b.publicKey], bitcoin.networks.regtest)
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest })
    psbt.setVersion(2)
    psbt.addInput({
      hash: Buffer.alloc(32, 9),
      index: 0,
      sequence: 0xfffffffd,
      witnessUtxo: { script: vault.output, value: 100000 },
      witnessScript: vault.witnessScript,
      sighashType: bitcoin.Transaction.SIGHASH_ALL
    })
    psbt.addOutput({
      script: bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, Buffer.from('x')]),
      value: 0
    })
    const summary = summarizeSortedMultiPsbt(psbt, new Set([vault.address]), bitcoin.networks.regtest)
    expect(() => assertP2wshSpendShape(summary)).toThrow(/exactly one payment/)
  })
})
