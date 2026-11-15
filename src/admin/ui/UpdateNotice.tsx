'use client'

import { useEffect, useState } from 'react'

type Check = { current: string; latest: string | null; updateAvailable: boolean; links: { changelog: string; start: string; sameRepo: boolean } }

const SEEN_KEY = 'engage-update-dismissed'

/** The update popup for super admins: appears when a newer Engage is released. Update opens the update page, then the changelog link stays. */
export function UpdateNotice() {
  const [check, setCheck] = useState<Check | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/admin-update-check', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<Check>) : null))
      .then((body) => {
        if (!live || !body?.updateAvailable || !body.latest) return
        try {
          if (window.localStorage.getItem(SEEN_KEY) === body.latest) return
        } catch {
          // Storage can be blocked; the popup then shows each visit.
        }
        setCheck(body)
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
  }, [])

  if (!check) return null
  const dismiss = () => {
    try {
      if (check.latest) window.localStorage.setItem(SEEN_KEY, check.latest)
    } catch {
      // Not remembered; fine.
    }
    setCheck(null)
  }

  return (
    <div role="dialog" aria-label="Update available" data-testid="update-notice" style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1000, maxWidth: 340 }} className="card">
      <div className="card-body stack">
        <strong>Engage {check.latest} is available</strong>
        <span className="text-muted">This site runs {check.current}. {check.links.sameRepo ? 'Update from the releases page, then redeploy.' : 'Sync your fork with the original, then redeploy.'}</span>
        <div className="cluster">
          <a
            className="btn"
            href={check.links.start}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              setStarted(true)
            }}
          >
            Update
          </a>
          <a className="btn" href={check.links.changelog} target="_blank" rel="noopener noreferrer">{started ? 'Read the changelog' : 'Changelog'}</a>
          <button type="button" className="btn" onClick={dismiss}>Later</button>
        </div>
      </div>
    </div>
  )
}
