import * as bip39 from 'bip39'
//@ts-ignore
import * as hdkey from 'hdkey'

import {
  ECPairInterface,
  bitcoin,
  eccManager,
  p2wshSortedMulti,
  encodeSortedMultiDescriptorPair,
  addressesMustMatch,
  assertSafeSighash,
  assertP2wshUtxoMatchesWitnessScript,
  bip48AccountPath,
  bip48OriginPath,
  CLASSIC_MULTISIG_GAP,
  CosignerXpub,
  ClassicMultisigError,
  ClassicMultisigNetwork
} from '@unisat/wallet-bitcoin'
import { ToSignInput } from '../types'
import { EventEmitter } from 'events'

export const CLASSIC_MULTISIG_TYPE = 'Classic Multisig'

type NetworkName = ClassicMultisigNetwork

export type ClassicMultisigDeserialize = {
  mnemonic?: string
  passphrase?: string
  k: number
  cosigners: CosignerXpub[]
  network?: NetworkName
  verified?: boolean
  receiveCount?: number
  coordinatorAddress0?: string
}

function masterFingerprint(masterPub: Buffer): string {
  return bitcoin.crypto.hash160(masterPub).subarray(0, 4).toString('hex')
}

function networkFromName(n: NetworkName): bitcoin.Network {
  if (n === 'mainnet') return bitcoin.networks.bitcoin
  if (n === 'testnet') return bitcoin.networks.testnet
  return bitcoin.networks.regtest
}

function hdVersions(network: bitcoin.Network) {
  return { private: network.bip32.private, public: network.bip32.public }
}

function hdVersionsForXpub(xpub: string) {
  if (xpub.startsWith('xpub')) return hdVersions(bitcoin.networks.bitcoin)
  if (xpub.startsWith('tpub')) return hdVersions(bitcoin.networks.testnet)
  throw new ClassicMultisigError('Unsupported extended key prefix', 'BAD_XPUB')
}

function assertXpubMatchesWalletNetwork(xpub: string, network: NetworkName): void {
  const wantsMain = network === 'mainnet'
  const isMain = xpub.startsWith('xpub')
  if (wantsMain !== isMain) {
    throw new ClassicMultisigError('xpub/tpub does not match wallet network', 'NETWORK_MIX')
  }
}

export class ClassicMultisigKeyring extends EventEmitter {
  static type = CLASSIC_MULTISIG_TYPE
  type = CLASSIC_MULTISIG_TYPE

  mnemonic = ''
  passphrase = ''
  k = 0
  cosigners: CosignerXpub[] = []
  network: NetworkName = 'mainnet'
  verified = false
  receiveCount = 1
  coordinatorAddress0 = ''
  mfp?: string

  private localNode: any = null
  private localPubkey = ''

  constructor(opts?: ClassicMultisigDeserialize) {
    super()
    if (opts) {
      this.applyState(opts)
    }
  }

  async serialize(): Promise<ClassicMultisigDeserialize> {
    return {
      mnemonic: this.mnemonic,
      passphrase: this.passphrase,
      k: this.k,
      cosigners: this.cosigners,
      network: this.network,
      verified: this.verified,
      receiveCount: this.receiveCount,
      coordinatorAddress0: this.coordinatorAddress0
    }
  }

  async deserialize(opts: ClassicMultisigDeserialize) {
    this.applyState(opts)
  }

  /** Sync so constructor cannot swallow OWN_KEY / address-mismatch as a voided promise. */
  private applyState(opts: ClassicMultisigDeserialize) {
    this.k = opts.k
    this.cosigners = opts.cosigners
    this.network = opts.network ?? 'mainnet'
    this.verified = opts.verified ?? false
    this.receiveCount = opts.receiveCount ?? 1
    this.coordinatorAddress0 = opts.coordinatorAddress0 ?? ''
    this.mnemonic = opts.mnemonic ?? ''
    this.passphrase = opts.passphrase ?? ''
    this.localNode = null
    this.localPubkey = ''
    this.mfp = undefined

    if (this.mnemonic) {
      this.initLocalSigner()
    }
    if (this.verified) {
      if (!this.coordinatorAddress0 || this.cosigners.length < 2) {
        throw new ClassicMultisigError(
          'Persisted verified=true without coordinator address / cosigners',
          'NOT_VERIFIED'
        )
      }
      addressesMustMatch(this.addressAt(0, 0), this.coordinatorAddress0)
    }
  }

  private initLocalSigner() {
    const seed = bip39.mnemonicToSeedSync(this.mnemonic, this.passphrase)
    const master = hdkey.fromMasterSeed(seed, hdVersions(networkFromName(this.network)))
    this.mfp = masterFingerprint(master.publicKey)
    const path = bip48AccountPath(this.network, 0)
    this.localNode = master.derive(path)
    const child = this.localNode.derive('m/0/0')
    this.localPubkey = Buffer.from(child.publicKey).toString('hex')

    if (this.cosigners.length === 0) {
      return
    }
    const ours = this.cosigners.some(
      (c) => c.fingerprint.toLowerCase() === this.mfp && c.xpub === this.localNode.publicExtendedKey
    )
    if (!ours) {
      throw new ClassicMultisigError(
        'This wallet fingerprint/xpub is not in the cosigner set',
        'OWN_KEY'
      )
    }
  }

  exportLocalXpub(): CosignerXpub {
    if (!this.localNode || !this.mfp) {
      throw new ClassicMultisigError('No local signer seed', 'NO_SEED')
    }
    return {
      fingerprint: this.mfp,
      originPath: bip48OriginPath(this.network, 0),
      xpub: this.localNode.publicExtendedKey
    }
  }

  descriptors() {
    return encodeSortedMultiDescriptorPair({ k: this.k, cosigners: this.cosigners })
  }

  addressAt(chain: 0 | 1, index: number): string {
    return this.paymentAt(chain, index).address
  }

  paymentAt(chain: 0 | 1, index: number) {
    const pubkeys = this.cosigners.map((c) => {
      assertXpubMatchesWalletNetwork(c.xpub, this.network)
      const node = hdkey.fromExtendedKey(c.xpub, hdVersionsForXpub(c.xpub)).derive(
        `m/${chain}/${index}`
      )
      return Buffer.from(node.publicKey)
    })
    return p2wshSortedMulti(this.k, pubkeys, networkFromName(this.network))
  }

  verifyCoordinatorAddress(address0: string) {
    const local = this.addressAt(0, 0)
    addressesMustMatch(local, address0)
    this.coordinatorAddress0 = address0
    this.verified = true
    return local
  }

  async addAccounts(n = 1): Promise<string[]> {
    const start = this.receiveCount
    this.receiveCount = Math.min(this.receiveCount + n, CLASSIC_MULTISIG_GAP + start)
    return this.getAccounts()
  }

  async getAccounts(): Promise<string[]> {
    const out: string[] = []
    for (let i = 0; i < this.receiveCount; i++) {
      out.push(this.addressAt(0, i))
    }
    return out
  }

  async signTransaction(psbt: bitcoin.Psbt, inputs: ToSignInput[]): Promise<bitcoin.Psbt> {
    if (!this.verified) {
      throw new ClassicMultisigError('Address match gate not passed', 'NOT_VERIFIED')
    }
    if (!this.mnemonic || !this.localPubkey) {
      throw new ClassicMultisigError('Watch-only combiner cannot sign', 'NO_SEED')
    }
    for (const input of inputs) {
      const data = psbt.data.inputs[input.index]
      assertSafeSighash(data.sighashType)
      if (input.sighashTypes) {
        for (const t of input.sighashTypes) assertSafeSighash(t)
      }
      assertP2wshUtxoMatchesWitnessScript(data.witnessUtxo, data.witnessScript)
      const inputSigner = this.signerForWitness(data.witnessScript!)
      psbt.signInput(input.index, inputSigner, input.sighashTypes)
    }
    return psbt
  }

  async signMessage(): Promise<string> {
    throw new ClassicMultisigError('BIP322 message sign is not in v1 classic multisig', 'NO_MSG')
  }

  async verifyMessage(): Promise<boolean> {
    return false
  }

  async exportAccount(): Promise<string> {
    throw new ClassicMultisigError('Refusing to export a private key from a multisig wallet', 'NO_EXPORT')
  }

  removeAccount(): void {
    throw new ClassicMultisigError('Cannot remove a cosigner from a verified wallet', 'FROZEN')
  }

  private signerForWitness(witnessScript: Buffer): ECPairInterface {
    if (!this.localNode) {
      throw new ClassicMultisigError('No local signer seed', 'NO_SEED')
    }
    const search = Math.max(this.receiveCount, CLASSIC_MULTISIG_GAP)
    for (const chain of [0, 1] as const) {
      for (let i = 0; i < search; i++) {
        const pay = this.paymentAt(chain, i)
        if (pay.witnessScript.equals(witnessScript)) {
          const child = this.localNode.derive(`m/${chain}/${i}`)
          return eccManager.eccPair.fromPrivateKey(Buffer.from(child.privateKey), {
            compressed: true
          })
        }
      }
    }
    throw new ClassicMultisigError('Local key not in this input witness script', 'OWN_KEY')
  }
}
