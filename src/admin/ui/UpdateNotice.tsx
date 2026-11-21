'use client'

import { useEffect, useState } from 'react'

type Check = {
  current: string
  latest: string | null
  updateAvailable: boolean
  oneClick?: boolean
  lean?: boolean
  manifest?: { notes: string; requiresMigration: boolean; requiresWorkerUpdate?: boolean; destructive: boolean }
}

const SEEN_KEY = 'engage-update-dismissed'
const post = (url: string, body: unknown = {}): Promise<Response> =>
  fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/** A new Worker release needs action only when the manifest says the Worker changed. No manifest: unknown, so ask. */
const needsWorker = (c: Check): boolean => c.updateAvailable && Boolean(c.latest) && c.manifest?.requiresWorkerUpdate !== false

/**
 * The one update popup (super admins only), with two separate actions because either can be needed without the other:
 *  - Tables: the database has migrations this code runs that are not recorded yet. One click runs them.
 *  - Code: a newer release changes the Worker. One click updates the install repository (a backup is taken first); the
 *    host then redeploys. Needs a GitHub token, entered once here.
 * Releases that change only static files (admin assets, builder scripts, Shine, Spark) reach installs through stable URLs
 * and never show anything.
 */
export function UpdateNotice() {
  const [check, setCheck] = useState<Check | null>(null)
  const [migrate, setMigrate] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrateMsg, setMigrateMsg] = useState('')
  const [applying, setApplying] = useState(false)
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmDestructive, setConfirmDestructive] = useState(false)
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState('')
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/admin-engage-migrate', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? (res.json() as Promise<{ pending?: boolean }>) : null))
      .then((body) => {
        if (live && body?.pending) setMigrate(true)
      })
      .catch((): void => undefined)
    fetch('/api/admin-update-check', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<Check>) : null))
      .then((body) => {
        if (!live || !body || !needsWorker(body)) return
        try {
          if (window.localStorage.getItem(SEEN_KEY) === String(body.latest)) return
        } catch {
          // Storage can be blocked; the popup then shows each visit.
        }
        setCheck(body)
        setConnected(Boolean(body.oneClick))
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
  }, [])

  if (!check && !migrate) return null

  const later = () => {
    try {
      if (check?.latest) window.localStorage.setItem(SEEN_KEY, check.latest)
    } catch {
      // Not remembered; fine.
    }
    setCheck(null)
    setMigrate(false)
  }

  const runMigration = async (): Promise<void> => {
    setMigrating(true)
    setMigrateMsg('')
    try {
      const res = await post('/api/admin-engage-migrate')
      if (res.ok) window.location.reload()
      else setMigrateMsg('The table update did not finish. Nothing was dropped. Try again, or restore the backup taken before the update.')
    } catch {
      setMigrateMsg('Could not reach the site. Try again.')
    }
    setMigrating(false)
  }

  const connect = async (): Promise<void> => {
    setApplying(true)
    setCodeMsg(null)
    try {
      const res = await post('/api/admin-update-connect', { token, repo })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (res.ok && body.ok) {
        setConnected(true)
        setToken('')
        setCodeMsg({ ok: true, text: body.message ?? 'Connected.' })
      } else setCodeMsg({ ok: false, text: body.message ?? 'Could not connect.' })
    } catch {
      setCodeMsg({ ok: false, text: 'Could not reach the site. Try again.' })
    }
    setApplying(false)
  }

  const updateCode = async (skipBackup = false): Promise<void> => {
    setApplying(true)
    setCodeMsg(null)
    try {
      const res = await post('/api/admin-update-apply', { skipBackup, confirmDestructive })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; needsBackupChoice?: boolean }
      if (!res.ok && body.needsBackupChoice) setCodeMsg({ ok: false, text: `${body.message ?? 'The safety backup did not finish.'} Press Update again to continue without one.` })
      else setCodeMsg({ ok: res.ok && body.ok === true, text: body.message ?? 'The update did not start.' })
      if (!res.ok && body.needsBackupChoice) setCodeMsg((m) => (m ? { ...m, ok: false } : m))
    } catch {
      setCodeMsg({ ok: false, text: 'Could not reach the site. Try again.' })
    }
    setApplying(false)
  }

  const destructive = Boolean(check?.manifest?.destructive)
  return (
    <div role="dialog" aria-label="Updates" data-testid="update-notice" style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1000, maxWidth: 360 }} className="card">
      <div className="card-body stack">
        {migrate ? (
          <div className="stack" data-testid="update-tables">
            <strong data-testid="migration-bar">Tables need updating</strong>
            <span className="text-muted">Your database is behind this version. Creating and updating tables keeps existing data.</span>
            {migrateMsg ? <span role="alert">{migrateMsg}</span> : null}
            <div className="cluster">
              <button type="button" className="btn" disabled={migrating} onClick={() => void runMigration()}>{migrating ? 'Updating tables…' : 'Update tables'}</button>
            </div>
          </div>
        ) : null}
        {check ? (
          <div className="stack" data-testid="update-code">
            <strong>Engage {check.latest} is ready for this site</strong>
            <span className="text-muted">This site runs {check.current}. Updating changes the code of this site; tables are updated separately.</span>
            {check.manifest?.notes ? <span className="text-muted" data-testid="update-notice-notes" style={{ whiteSpace: 'pre-wrap' }}>{check.manifest.notes.slice(0, 400)}</span> : null}
            {destructive ? (
              <label className="cluster" data-testid="update-notice-destructive">
                <input type="checkbox" checked={confirmDestructive} onChange={(e) => setConfirmDestructive(e.target.checked)} />
                <span>This release changes existing data. A backup is taken first. I understand.</span>
              </label>
            ) : null}
            {!connected ? (
              <div className="stack" data-testid="update-connect">
                <span className="text-muted">One time setup: paste a GitHub token for your install repository (fine-grained, this repository only, Contents read and write). It is stored encrypted on this site.</span>
                <input className="input" type="password" autoComplete="off" placeholder="GitHub token" value={token} onChange={(e) => setToken(e.target.value)} />
                <input className="input" type="text" autoComplete="off" placeholder="Repository (owner/name), optional" value={repo} onChange={(e) => setRepo(e.target.value)} />
                <div className="cluster">
                  <button type="button" className="btn" disabled={applying || !token.trim()} onClick={() => void connect()}>{applying ? 'Checking…' : 'Connect'}</button>
                </div>
              </div>
            ) : (
              <div className="cluster">
                <button type="button" className="btn" disabled={applying || (destructive && !confirmDestructive)} onClick={() => void updateCode(codeMsg?.ok === false && /without one/.test(codeMsg.text))}>{applying ? 'Updating…' : 'Update site code'}</button>
              </div>
            )}
            {codeMsg ? <span role="status" className={codeMsg.ok ? 'text-muted' : 'badge'}>{codeMsg.text}</span> : null}
          </div>
        ) : null}
        <div className="cluster">
          <button type="button" className="btn" onClick={later}>Later</button>
        </div>
      </div>
    </div>
  )
}
