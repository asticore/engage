'use client'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import React, { useMemo } from 'react'

/** The preview widths: a computer window, a phone, and the usual content width of three mail apps. */
export type PreviewDevice = 'desktop' | 'mobile' | 'gmail' | 'outlook' | 'apple'
export const PREVIEW_WIDTHS: Record<Exclude<PreviewDevice, 'desktop'>, { label: string; width: number }> = {
  mobile: { label: 'Phone', width: 375 },
  gmail: { label: 'Gmail', width: 640 },
  outlook: { label: 'Outlook', width: 560 },
  apple: { label: 'Apple Mail', width: 700 },
}
export type PreviewTheme = 'light' | 'dark'

type Props = {
  html: string
  device: PreviewDevice
  theme: PreviewTheme
  onDevice: (device: PreviewDevice) => void
  onTheme: (theme: PreviewTheme) => void
}

/**
 * Adds a dark page behind the email to show roughly how it looks in dark mode.
 * Email apps decide their own dark colours, so this is only an approximation.
 */
const withTheme = (html: string, theme: PreviewTheme): string =>
  theme === 'dark' ? html.replace('</head>', '<style>body{background:#1d1d1f !important;}</style></head>') : html

/** The live preview of one email, in a sandboxed frame so nothing in it can run. */
export function PreviewPane({ html, device, theme, onDevice, onTheme }: Props) {
  const t = useAdminT()
  const srcDoc = useMemo(() => withTheme(html, theme), [html, theme])
  return (
    <div className="ed-preview">
      <div className="ed-preview__toolbar" role="group" aria-label={t('aria.email.previewOptions')}>
        <div className="ed-segment">
          <button type="button" className="ed-button ed-button--quiet" aria-pressed={device === 'desktop'} onClick={() => onDevice('desktop')}>
            Computer
          </button>
          {(Object.keys(PREVIEW_WIDTHS) as Exclude<PreviewDevice, 'desktop'>[]).map((id) => (
            <button key={id} type="button" className="ed-button ed-button--quiet" aria-pressed={device === id} onClick={() => onDevice(id)}>
              {PREVIEW_WIDTHS[id].label}
            </button>
          ))}
        </div>
        <div className="ed-segment">
          <button type="button" className="ed-button ed-button--quiet" aria-pressed={theme === 'light'} onClick={() => onTheme('light')}>
            Light
          </button>
          <button type="button" className="ed-button ed-button--quiet" aria-pressed={theme === 'dark'} onClick={() => onTheme('dark')}>
            Dark
          </button>
        </div>
      </div>
      <div className={`ed-preview__frame ed-preview__frame--${device}`} style={device === 'desktop' ? undefined : { width: PREVIEW_WIDTHS[device].width }}>
        <iframe title="Email preview" sandbox="" srcDoc={srcDoc} className="ed-preview__iframe" />
      </div>
    </div>
  )
}
