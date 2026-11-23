'use client'
import { useEffect, useState } from 'react'
import type { RedirectPrompt } from './useDocumentSave'

/**
 * The question shown before a save that changes an address: create the redirect from the old address, or save without one.
 * A blog or shop address change always redirects (nothing to skip), so it only asks to confirm.
 */
export function RedirectPromptDialog({ prompt }: { prompt: RedirectPrompt | null }) {
  const [updateLinks, setUpdateLinks] = useState(true)
  useEffect(() => {
    if (!prompt) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') prompt.resolve('cancel')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prompt])
  if (!prompt) return null
  const isSlug = prompt.kind === 'slug'
  return (
    <div className="pages-tree__dialog-overlay" onClick={() => prompt.resolve('cancel')}>
      <div aria-modal="true" className="pages-tree__dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Address change">
        <h3>{isSlug ? 'Create a redirect?' : 'Confirm the address change'}</h3>
        {prompt.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {isSlug && (
          <label style={{ alignItems: 'center', display: 'flex', gap: 8, marginTop: 12 }}>
            <input checked={updateLinks} onChange={(event) => setUpdateLinks(event.target.checked)} type="checkbox" />
            Also change links to this address on other pages, posts, products, templates, the header and the footer
          </label>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button autoFocus className="btn btn--primary" onClick={() => prompt.resolve('create', updateLinks)} type="button">
            {isSlug ? 'Create redirect and save' : 'Confirm and save'}
          </button>
          {isSlug && (
            <button className="btn" onClick={() => prompt.resolve('skip', updateLinks)} type="button">
              Save without redirect
            </button>
          )}
          <button className="btn" onClick={() => prompt.resolve('cancel')} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
