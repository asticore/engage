'use client'

import { useEffect, useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

type Check = { current: string; latest: string | null; updateAvailable: boolean; links: { changelog: string; start: string; sameRepo: boolean }; oneClick?: boolean; manifest?: { notes: string; requiresMigration: boolean; destructive: boolean }; referencesOutdated?: Array<{ id: string; name: string; current: string | null; latest: string | null }> }

const SEEN_KEY = 'engage-update-dismissed'

const seenValue = (body: Check): string => `${body.updateAvailable ? body.latest : ''}|${(body.referencesOutdated ?? []).map((r) => `${r.id}@${r.latest}`).join(',')}`

/** The update popup for super admins: appears when a newer Engage is released. Update opens the update page, then the changelog link stays. */
export function UpdateNotice() {
  const t = useAdminT()
  const [check, setCheck] = useState<Check | null>(null)
  const [started, setStarted] = useState(false)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/admin-update-check', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<Check>) : null))
      .then((body) => {
        const outdated = body?.referencesOutdated ?? []
        if (!live || !body || ((!body.updateAvailable || !body.latest) && outdated.length === 0)) return
        try {
          if (window.localStorage.getItem(SEEN_KEY) === seenValue(body)) return
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
      window.localStorage.setItem(SEEN_KEY, seenValue(check))
    } catch {
      // Not remembered; fine.
    }
    setCheck(null)
  }

  const applyNow = async (): Promise<void> => {
    setApplying(true)
    try {
      const res = await fetch('/api/admin-update-apply', { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      setResult({ ok: res.ok && body.ok === true, message: body.message ?? t('update.failed') })
    } catch {
      setResult({ ok: false, message: t('update.failed') })
    }
    setApplying(false)
  }

  return (
    <div role="dialog" aria-label={t('update.aria')} data-testid="update-notice" style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1000, maxWidth: 340 }} className="card">
      <div className="card-body stack">
        {check.updateAvailable && check.latest && (
          <>
            <strong>{t('update.title', { version: check.latest })}</strong>
            <span className="text-muted">{t('update.body', { current: check.current, how: check.links.sameRepo ? t('update.howSame') : t('update.howFork') })}</span>
          </>
        )}
        {check.updateAvailable && check.manifest?.notes ? (
          <span className="text-muted" data-testid="update-notice-notes" style={{ whiteSpace: 'pre-wrap' }}>{check.manifest.notes.slice(0, 400)}</span>
        ) : null}
        {check.updateAvailable && check.manifest?.destructive ? <span className="badge" data-testid="update-notice-destructive">This release changes existing data. A backup is taken first.</span> : null}
        {(check.referencesOutdated ?? []).length > 0 && (
          <span className="text-muted" data-testid="update-notice-references">
            {t('update.references', { names: (check.referencesOutdated ?? []).map((r) => r.name).join(', ') })}
          </span>
        )}
        {result ? <span role="status" className={result.ok ? 'text-muted' : 'badge'}>{result.message}</span> : null}
        <div className="cluster">
          {check.updateAvailable && check.latest && check.oneClick && !result?.ok ? <button type="button" className="btn" disabled={applying} onClick={() => void applyNow()}>{applying ? t('update.updating') : t('update.updateNow')}</button> : null}
          {check.updateAvailable && check.latest && (
            <>
              <a
                className="btn"
                href={check.links.start}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setStarted(true)
                }}
              >
                {t('update.update')}
              </a>
              <a className="btn" href={check.links.changelog} target="_blank" rel="noopener noreferrer">{started ? t('update.readChangelog') : t('update.changelog')}</a>
            </>
          )}
          <button type="button" className="btn" onClick={dismiss}>{t('update.later')}</button>
        </div>
      </div>
    </div>
  )
}
