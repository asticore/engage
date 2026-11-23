import React from 'react'

import { renderQrSvg } from '@/features/security/twoFactorQr'

import { mediaOf, num, pick, str } from './elementUtil'

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

export const UTILITY_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'qr-code': QrCodeElement,
  'pdf-viewer': PdfViewerElement,
}
