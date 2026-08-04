import { useEffect, useState } from 'react'
import { useI18n, useNavigation, useTools, useWallet } from 'src/context'

const GAP_OPTIONS = [20, 50, 100] as const

type Preview = {
  policyLabel: string
  previewAddresses: string[]
}

/**
 * Two-step import: preview derived addresses → user confirms → persist watch keyring.
 * Prevents silent switch to an attacker-supplied address set.
 */
export function useImportDescriptorScreenLogic() {
  const { t } = useI18n()
  const nav = useNavigation()
  const wallet = useWallet()
  const tools = useTools()

  const [raw, setRaw] = useState('')
  const [name, setName] = useState('')
  const [accountCount, setAccountCount] = useState<number>(20)
  const [error, setError] = useState('')
  const [disabled, setDisabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)

  useEffect(() => {
    setDisabled(!raw.trim() || busy)
    setError('')
    setPreview(null)
  }, [raw, accountCount, busy])

  const onPreview = async () => {
    setBusy(true)
    setError('')
    setPreview(null)
    try {
      const res = await wallet.previewDescriptor(raw.trim(), accountCount)
      setPreview({
        policyLabel: res.policy?.label || '',
        previewAddresses: res.previewAddresses || [],
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onConfirmImport = async () => {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      await wallet.importDescriptor(raw.trim(), name.trim() || undefined, accountCount)
      tools.toastSuccess(t('success') || 'Success')
      nav.navigate('MainScreen')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const clearPreview = () => {
    setPreview(null)
    setError('')
  }

  return {
    t,
    raw,
    setRaw,
    name,
    setName,
    accountCount,
    setAccountCount,
    gapOptions: GAP_OPTIONS,
    error,
    disabled,
    busy,
    preview,
    onPreview,
    onConfirmImport,
    clearPreview,
    onClickBack: () => nav.goBack(),
  }
}
