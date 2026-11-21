'use client'

import { useEffect, useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

type Check = { current: string; latest: string | null; updateAvailable: boolean; links: { changelog: string; start: string; sameRepo: boolean }; oneClick?: boolean; manifest?: { notes: string; requiresMigration: boolean; requiresWorkerUpdate?: boolean; destructive: boolean } }
type Migrate = { pending?: boolean }

const SEEN_KEY = 'engage-update-dismissed'

/** A new Worker release needs action only when the manifest says the Worker changed. No manifest: unknown, so ask. */
const needsWorker = (c: Check): boolean => c.updateAvailable && Boolean(c.latest) && c.manifest?.requiresWorkerUpdate !== false

const seenValue = (body: Check): string => (needsWorker(body) ? String(body.latest) : '')

/**
 * The one update popup (super admins only). It shows only when this install needs action: the database has migrations to run,
 * or a release that changes the Worker is available. Releases that change only static files (admin assets, builder scripts,
 * Shine, Spark) reach installs through stable URLs and never prompt.
 */
export function UpdateNotice() {
  const t = useAdminT()
  const [check, setCheck] = useState<Check | null>(null)
  const [migrate, setMigrate] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrateError, setMigrateError] = useState('')
  const [started, setStarted] = useState(false)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/admin-engage-migrate', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? (res.json() as Promise<Migrate>) : null))
      .then((body) => {
        if (live && body?.pending) setMigrate(true)
      })
      .catch((): void => undefined)
    fetch('/api/admin-update-check', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<Check> ) : null))
      .then((body) => {
        if (!live || !body || !needsWorker(body)) return
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

  const runMigration = async (): Promise<void> => {
    setMigrating(true)
    setMigrateError('')
    try {
      const res = await fetch('/api/admin-engage-migrate', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (res.ok) window.location.reload()
      else setMigrateError('The migration did not finish. Nothing was dropped. Try again, or restore the backup taken before the update.')
    } catch {
      setMigrateError('Could not reach the site. Try again.')
    }
    setMigrating(false)
  }

  if (!check && !migrate) return null
  const dismiss = () => {
    try {
      if (check) window.localStorage.setItem(SEEN_KEY, seenValue(check))
    } catch {
      // Not remembered; fine.
    }
    setCheck(null)
    setMigrate(false)
  }

  const applyNow = async (): Promise<void> => {
    setApplying(true)
    try {
      const res = await fetch('/api/admin-update-apply', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
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
        {migrate ? (
          <>
            <strong data-testid="migration-bar">Finish update: the database needs a quick migration.</strong>
            <span className="text-muted">Existing data is kept.</span>
            {migrateError ? <span role="alert">{migrateError}</span> : null}
            <div className="cluster">
              <button type="button" className="btn" disabled={migrating} onClick={() => void runMigration()}>{migrating ? 'Migrating…' : 'Run migration'}</button>
            </div>
          </>
        ) : null}
        {check && check.updateAvailable && check.latest && (
          <>
            <strong>{t('update.title', { version: check.latest })}</strong>
            <span className="text-muted">{t('update.body', { current: check.current, how: check.links.sameRepo ? t('update.howSame') : t('update.howFork') })}</span>
          </>
        )}
        {check?.updateAvailable && check.manifest?.notes ? (
          <span className="text-muted" data-testid="update-notice-notes" style={{ whiteSpace: 'pre-wrap' }}>{check.manifest.notes.slice(0, 400)}</span>
        ) : null}
        {check?.updateAvailable && check.manifest?.destructive ? <span className="badge" data-testid="update-notice-destructive">This release changes existing data. A backup is taken first.</span> : null}
        {result ? <span role="status" className={result.ok ? 'text-muted' : 'badge'}>{result.message}</span> : null}
        <div className="cluster">
          {check && check.updateAvailable && check.latest && check.oneClick && !result?.ok ? <button type="button" className="btn" disabled={applying} onClick={() => void applyNow()}>{applying ? t('update.updating') : t('update.updateNow')}</button> : null}
          {check && check.updateAvailable && check.latest && (
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
