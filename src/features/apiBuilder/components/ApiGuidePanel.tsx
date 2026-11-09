'use client'

import React, { useState } from 'react'

import { usePortalText } from '@/features/accounts/components/PortalText'

import { myApiGuideAction, type PortalGuide } from '../portalGuide'

/** The customer's API guide in the members portal: only the endpoints their account can call. Loaded on demand. */
export const ApiGuidePanel: React.FC = () => {
  const tx = usePortalText()
  const [guide, setGuide] = useState<PortalGuide | null>(null)
  const [open, setOpen] = useState(false)

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    if (!guide) setGuide(await myApiGuideAction())
    setOpen(true)
  }

  const download = () => {
    if (!guide?.markdown) return
    const url = URL.createObjectURL(new Blob([guide.markdown], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'api-guide.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="api-guide-panel">
      <button type="button" onClick={() => void toggle()} aria-expanded={open}>
        {open ? tx('panel.guideHide') : tx('panel.guideShow')}
      </button>
      {open && guide && (
        <div>
          {!guide.ok && <p className="account-note account-note--error">{guide.error}</p>}
          {guide.ok && guide.endpoints && guide.endpoints.length === 0 && <p>{tx('panel.guideNone')}</p>}
          {guide.ok && guide.endpoints && guide.endpoints.length > 0 && (
            <>
              <ul>
                {guide.endpoints.map((e) => (
                  <li key={e.path}>
                    <strong>{e.name}</strong> <code>{e.path}</code> ({e.methods.join(', ')})
                  </li>
                ))}
              </ul>
              <button type="button" onClick={download}>
                {tx('panel.guideDownload')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
