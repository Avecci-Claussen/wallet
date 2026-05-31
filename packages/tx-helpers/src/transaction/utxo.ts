import { decodeAddress } from '@unisat/wallet-bitcoin'
import { AddressType, NetworkType } from '@unisat/wallet-types'
import { UnspentOutput } from 'src/types'
import { ErrorCodes, WalletError } from '@unisat/wallet-shared'

function hasInscription(utxos: UnspentOutput[]) {
  return utxos.some(v => v.inscriptions.length > 0)
}

function hasAnyAssets(utxos: UnspentOutput[]) {
  return utxos.some(v => v.inscriptions.length > 0 || (v.runes && v.runes.length > 0))
}

/**
 * select utxos so that the total amount of utxos is greater than or equal to targetAmount
 * return the selected utxos and the unselected utxos
 * @param utxos
 * @param targetAmount
 */
function selectBtcUtxos(utxos: UnspentOutput[], targetAmount: number) {
  let selectedUtxos: UnspentOutput[] = []
  let remainingUtxos: UnspentOutput[] = []

  let totalAmount = 0
  for (const utxo of utxos) {
    if (totalAmount < targetAmount) {
      totalAmount += utxo.satoshis
      selectedUtxos.push(utxo)
    } else {
      remainingUtxos.push(utxo)
    }
  }

  return {
    selectedUtxos,
    remainingUtxos,
  }
}

/**
 * return the added virtual size of the utxo
 */
function getAddedVirtualSize(addressType: AddressType) {
  if (addressType === AddressType.P2WPKH || addressType === AddressType.M44_P2WPKH) {
    return 41 + (1 + 1 + 72 + 1 + 33) / 4
  } else if (addressType === AddressType.P2TR || addressType === AddressType.M44_P2TR) {
    return 41 + (1 + 1 + 64) / 4
  } else if (addressType === AddressType.P2PKH) {
    return 41 + 1 + 1 + 72 + 1 + 33
  } else if (addressType === AddressType.P2SH_P2WPKH) {
    return 41 + 24 + (1 + 1 + 72 + 1 + 33) / 4
  }
  throw new WalletError(ErrorCodes.UNKNOWN)
}

function getOutputVirtualSize(addressType: AddressType) {
  if (addressType === AddressType.P2WPKH || addressType === AddressType.M44_P2WPKH) {
    return 31
  } else if (addressType === AddressType.P2TR || addressType === AddressType.M44_P2TR) {
    return 43
  } else if (addressType === AddressType.P2PKH) {
    return 34
  } else if (addressType === AddressType.P2SH_P2WPKH) {
    return 32
  }
  throw new WalletError(ErrorCodes.UNKNOWN)
}

function hasWitness(addressType: AddressType) {
  return (
    addressType === AddressType.P2WPKH ||
    addressType === AddressType.M44_P2WPKH ||
    addressType === AddressType.P2TR ||
    addressType === AddressType.M44_P2TR ||
    addressType === AddressType.P2SH_P2WPKH
  )
}

export function getUtxoDust(addressType: AddressType) {
  if (addressType === AddressType.P2WPKH || addressType === AddressType.M44_P2WPKH) {
    return 294
  } else if (addressType === AddressType.P2TR || addressType === AddressType.M44_P2TR) {
    return 330
  } else {
    return 546
  }
}

// deprecated
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getAddressUtxoDust(
  address: string,
  networkType: NetworkType = NetworkType.MAINNET
) {
  return decodeAddress(address).dust
}

export const utxoHelper = {
  hasInscription,
  hasAnyAssets,
  selectBtcUtxos,
  getAddedVirtualSize,
  getOutputVirtualSize,
  hasWitness,
  getUtxoDust,
  getAddressUtxoDust,
}
