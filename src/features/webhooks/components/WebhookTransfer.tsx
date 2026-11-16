'use client'

import React, { useRef, useState } from 'react'

import { exportWebhooksAction, importWebhooksAction } from '../actions'

/** Export and import buttons for the webhooks list. English only. Imported webhooks arrive switched off. */
export const WebhookTransfer: React.FC<{ onImported: () => void | Promise<void>; canImport: boolean }> = ({ onImported, canImport }) => {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const download = async () => {
    const result = await exportWebhooksAction()
    if (result.ok === false) return setMessage(result.error)
    const url = URL.createObjectURL(new Blob([result.value!.json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'webhooks.json'
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Exported. The file holds settings only, no signing secrets.')
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    const result = await importWebhooksAction(await file.text())
    if (input.current) input.current.value = ''
    if (result.ok === false) return setMessage(result.error)
    const { created, skipped } = result.value!
    setMessage(`Imported ${created} webhook${created === 1 ? '' : 's'}, switched off. Open each one, check it, rotate its secret to see it, then switch it on.${skipped.length ? ` Skipped: ${skipped.join(' ')}` : ''}`)
    await onImported()
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <button type="button" onClick={download}>Export settings</button>
      {canImport && (
        <>
          <button type="button" onClick={() => input.current?.click()}>Import settings</button>
          <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => void upload(e.target.files?.[0])} />
        </>
      )}
      {message && <span role="status">{message}</span>}
    </div>
  )
}
