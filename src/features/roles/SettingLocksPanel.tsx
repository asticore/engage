'use client'

import { useCallback, useEffect, useState } from 'react'

import { GROUP_KEYS } from '@/views/visualEditor/designHelpers'

import type { SettingLock, SettingLockScope } from './settingLocks'

const SCOPE_LABEL: Record<SettingLockScope, string> = { site: 'The whole site', block: 'One kind of block', template: 'One template', email: 'Emails' }
const GROUPS = Object.keys(GROUP_KEYS)
const split = (value: string): string[] => value.split(',').map((x) => x.trim()).filter(Boolean)

const blank = (): SettingLock => ({ scope: 'site', target: '', groups: [], keys: [], unlockRoles: [] })

/** Settings > Design locks: lock design settings so editors cannot change them. Admins always can. */
export function SettingLocksPanel() {
  const [locks, setLocks] = useState<SettingLock[] | null>(null)
  const [draft, setDraft] = useState<SettingLock | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-setting-locks', { cache: 'no-store' })
    if (res.ok) setLocks(((await res.json()) as { locks: SettingLock[] }).locks)
    else setMessage('Could not load the locks.')
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (payload: unknown): Promise<boolean> => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin-setting-locks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setMessage(body.error ?? 'That did not work.')
        return false
      }
      await load()
      return true
    } finally {
      setBusy(false)
    }
  }

  if (!locks) return <p className="text-muted">{message || 'Loading...'}</p>
  const describe = (l: SettingLock): string => {
    const what = [...l.groups.map((g) => (g === '*' ? 'everything' : g)), ...l.keys].join(', ')
    const where = l.scope === 'site' ? 'everywhere' : l.scope === 'email' ? `emails${l.target ? ` (${l.target})` : ''}` : `${l.scope} ${l.target}`
    return `${what} locked on ${where}. ${l.unlockRoles.length ? `Can be changed by: ${l.unlockRoles.join(', ')} and admins.` : 'Only admins can change them.'}`
  }

  return (
    <div className="stack">
      {message ? <p className="text-muted" role="alert">{message}</p> : null}
      {locks.length === 0 && !draft ? <p className="text-muted">Nothing is locked. Add a lock to keep editors from changing fonts, colours, spacing and more.</p> : null}
      {locks.map((lock) => (
        <div className="card" key={lock.id}>
          <div className="card-body cluster">
            <span>{describe(lock)}</span>
            <button type="button" className="btn" onClick={() => setDraft(lock)}>Edit</button>
            <button type="button" className="btn" disabled={busy} onClick={() => post({ action: 'delete', id: lock.id })}>Remove</button>
          </div>
        </div>
      ))}
      {draft ? (
        <div className="card">
          <div className="card-body stack">
            <label className="field">Applies to
              <select className="select" value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as SettingLockScope, target: '' })}>
                {(Object.keys(SCOPE_LABEL) as SettingLockScope[]).map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
              </select>
            </label>
            {draft.scope !== 'site' ? (
              <label className="field">{draft.scope === 'block' ? 'Block type (for example button, heading, section)' : draft.scope === 'template' ? 'Template number' : 'Email key (blank for all emails)'}
                <input className="input" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value.trim() })} />
              </label>
            ) : null}
            <fieldset className="field">
              <legend>Lock these groups</legend>
              <div className="cluster">
                {GROUPS.map((g) => (
                  <label key={g}><input type="checkbox" checked={draft.groups.includes(g)} onChange={(e) => setDraft({ ...draft, groups: e.target.checked ? [...draft.groups, g] : draft.groups.filter((x) => x !== g) })} /> {g}</label>
                ))}
              </div>
            </fieldset>
            <label className="field">Or single settings (comma separated, for example fontSize, bgColor)
              <input className="input" value={draft.keys.join(', ')} onChange={(e) => setDraft({ ...draft, keys: split(e.target.value) })} />
            </label>
            <label className="field">Roles that can still change them (comma separated role slugs, admins always can)
              <input className="input" value={draft.unlockRoles.join(', ')} onChange={(e) => setDraft({ ...draft, unlockRoles: split(e.target.value) })} />
            </label>
            <div className="cluster">
              <button type="button" className="btn" disabled={busy} onClick={async () => { if (await post({ lock: draft })) setDraft(null) }}>Save lock</button>
              <button type="button" className="btn" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <div><button type="button" className="btn" onClick={() => setDraft(blank())}>Add lock</button></div>
      )}
    </div>
  )
}
