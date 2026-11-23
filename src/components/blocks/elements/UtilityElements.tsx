import React from 'react'

import { renderQrSvg } from '@/features/security/twoFactorQr'

import { PollClient } from './PollClient'
import { cleanPollId } from '@/features/polls/core'
import { cells, mediaOf, num, pick, str } from './elementUtil'

type P = Record<string, unknown>

/** The most a QR code may hold in the type 0 (auto) encoder with level M, so a long paste cannot hang a render. */
const QR_MAX = 1000

/**
 * `qr-code`: an inline SVG from the same local encoder the two-step sign-in uses. The data is encoded as text,
 * so nothing in it can run.
 */
export const QrCodeElement: React.FC<P> = (p) => {
  const data = str(p.data).trim().slice(0, QR_MAX)
  const size = Math.round(num(p.size, 200, 80, 600))
  const align = pick(p.align, ['left', 'center', 'right'] as const, 'center')
  const label = str(p.label, 'QR code').replace(/[<>&"]/g, '')
  const caption = str(p.caption).trim()
  if (!data) return <p className="be-el-qr__note">Add an address or text to make a QR code.</p>
  let svg = ''
  try {
    svg = renderQrSvg(data, { label })
  } catch {
    return <p className="be-el-qr__note">That text is too long for a QR code.</p>
  }
  return (
    <figure className={`be-el-qr be-el-qr--${align}`} style={{ margin: 0, textAlign: align }}>
      <div style={{ width: size, maxWidth: '100%', display: 'inline-block', background: '#fff', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}

/** `pdf-viewer`: the browser's own PDF viewer in a lazy frame, with a plain download link as the fallback. */
export const PdfViewerElement: React.FC<P> = (p) => {
  const file = mediaOf(p.file) ?? mediaOf(p.url)
  const title = str(p.title, 'Document').trim() || 'Document'
  const height = Math.round(num(p.height, 600, 200, 1200))
  if (!file) return <p className="be-el-pdf__note">Choose a PDF to show.</p>
  const src = `${file.url}#toolbar=1&navpanes=0`
  return (
    <div className="be-el-pdf">
      <iframe src={src} title={title} loading="lazy" style={{ width: '100%', height, border: 0 }} referrerPolicy="no-referrer" />
      {p.download !== false ? (
        <p className="be-el-pdf__link">
          <a href={file.url} download>{`Download ${title} (PDF)`}</a>
        </p>
      ) : null}
    </div>
  )
}

/** Menu lines `Label | address`; only safe web, tel, mailto and in-page addresses are kept. Exported for tests. */
export function parseFabItems(v: unknown): { label: string; href: string }[] {
  return cells(v, 2).flatMap(([label, href]) => {
    const h = (href ?? '').trim()
    const ok = h === '#top' || /^#[\w-]+$/.test(h) || /^(tel|mailto):[^\s]+$/i.test(h) || Boolean(mediaOf(h))
    return label && ok ? [{ label, href: h }] : []
  }).slice(0, 8)
}

/** `floating-action-button`: a fixed round button with a native details menu, so it needs no script. */
export const FloatingActionButtonElement: React.FC<P> = (p) => {
  const items = parseFabItems(p.items)
  if (items.length === 0) return <p className="be-el-fab__note">Add menu items, one per line: Label | address.</p>
  const corner = pick(p.corner, ['bottom-right', 'bottom-left'] as const, 'bottom-right')
  const side = corner === 'bottom-left' ? { left: 16 } : { right: 16 }
  return (
    <details className="be-el-fab" style={{ position: 'fixed', bottom: 16, zIndex: 50, ...side }}>
      <summary aria-label={str(p.label, 'Quick actions')} style={{ listStyle: 'none', cursor: 'pointer', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: 'var(--accent, #111)', color: '#fff', boxShadow: '0 2px 10px rgb(0 0 0 / .3)' }}>
        {str(p.icon, '+').slice(0, 4)}
      </summary>
      <ul style={{ position: 'absolute', bottom: 64, [corner === 'bottom-left' ? 'left' : 'right']: 0, listStyle: 'none', margin: 0, padding: 8, background: '#fff', color: '#111', borderRadius: 8, boxShadow: '0 2px 12px rgb(0 0 0 / .25)', minWidth: 160 }}>
        {items.map((it) => (
          <li key={it.label + it.href}><a href={it.href} style={{ display: 'block', padding: '6px 10px', color: 'inherit' }}>{it.label}</a></li>
        ))}
      </ul>
    </details>
  )
}

/** `poll`: options come from the lines; the vote id must be a clean key. */
export const PollElement: React.FC<P> = (p) => {
  const id = cleanPollId(p.pollId)
  const options = String(p.options ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 12)
  if (!id || options.length < 2) return <p className="be-el-poll__note">Give the poll an id, a question and at least two options.</p>
  return <PollClient pollId={id} question={str(p.question)} options={options} showResults={p.showResults !== false} />
}

export const UTILITY_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'qr-code': QrCodeElement,
  'pdf-viewer': PdfViewerElement,
  poll: PollElement,
  'floating-action-button': FloatingActionButtonElement,
}
