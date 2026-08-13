import { encodeSortedMultiDescriptorPair, parseCosignerLines } from '../src/multisig/descriptor'

function $(id: string): HTMLInputElement | HTMLTextAreaElement | HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error('missing #' + id)
  return el
}

function assemble(): void {
  const err = $('err')
  const out = $('out')
  err.textContent = ''
  out.textContent = ''
  try {
    const k = Number(($('k') as HTMLInputElement).value)
    const cosigners = parseCosignerLines(($('keys') as HTMLTextAreaElement).value)
    const pair = encodeSortedMultiDescriptorPair({ k, cosigners })
    out.textContent = [
      'Receive (import this in UniSat, then confirm address 0 matches every signer):',
      pair.receive,
      '',
      'Change (backup this too):',
      pair.change,
      '',
      'Do not fund an address shown only on this page. Each wallet must re-derive.'
    ].join('\n')
  } catch (e) {
    err.textContent = e instanceof Error ? e.message : String(e)
  }
}

function copyOut(): void {
  const text = $('out').textContent || ''
  void navigator.clipboard.writeText(text)
}

document.getElementById('assemble')?.addEventListener('click', assemble)
document.getElementById('copy')?.addEventListener('click', copyOut)
