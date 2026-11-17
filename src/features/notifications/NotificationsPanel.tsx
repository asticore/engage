'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Trigger = { key: string; label: string; recipients: string[] }
type Rule = { id?: number; name: string; event: string; channel: 'email' | 'push'; recipient: string; customTo: string; subject: string; body: string; layout: 'plain' | 'brand'; enabled: boolean }
type Data = { rules: Rule[]; triggers: Trigger[]; tags: Record<string, { tag: string; label: string }[]> }

const blank = (event: string): Rule => ({ name: '', event, channel: 'email', recipient: 'admin', customTo: '', subject: '', body: '', layout: 'brand', enabled: true })
const RECIPIENT_LABEL: Record<string, string> = { customer: 'The customer', admin: 'The shop admin address', custom: 'A set address' }

/** Email > Notifications: rules that send an email or a push when something happens. Tags come from the trigger's own list. */
export function NotificationsPanel() {
  const [data, setData] = useState<Data | null>(null)
  const [draft, setDraft] = useState<Rule | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-notification-rules', { cache: 'no-store' })
    if (res.ok) setData((await res.json()) as Data)
    else setMessage('Could not load the notifications.')
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (payload: unknown, url = '/api/admin-notification-rules'): Promise<boolean> => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
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

  const [pushState, setPushState] = useState<'unknown' | 'on' | 'off' | 'unsupported'>('unknown')
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported')
      return
    }
    navigator.serviceWorker.getRegistration('/engage-push-sw.js').then((reg) => reg?.pushManager.getSubscription()).then((sub) => setPushState(sub ? 'on' : 'off')).catch(() => setPushState('off'))
  }, [])

  const turnOnPush = async () => {
    setMessage('')
    try {
      if ((await Notification.requestPermission()) !== 'granted') return setMessage('Allow notifications in the browser to turn push on.')
      const key = (await (await fetch('/api/admin-push', { cache: 'no-store' })).json()) as { publicKey: string }
      const reg = await navigator.serviceWorker.register('/engage-push-sw.js')
      await navigator.serviceWorker.ready
      const raw = atob(key.publicKey.replace(/-/g, '+').replace(/_/g, '/'))
      const applicationServerKey = Uint8Array.from(raw, (c) => c.charCodeAt(0))
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      await post({ subscription: sub.toJSON() }, '/api/admin-push')
      setPushState('on')
    } catch {
      setMessage('Could not turn push on in this browser.')
    }
  }
  const turnOffPush = async () => {
    const reg = await navigator.serviceWorker.getRegistration('/engage-push-sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await post({ action: 'unsubscribe', endpoint: sub.endpoint }, '/api/admin-push')
      await sub.unsubscribe()
    }
    setPushState('off')
  }

  if (!data) return <p className="text-muted">{message || 'Loading...'}</p>
  const trigger = data.triggers.find((t) => t.key === draft?.event)
  const insertTag = (tag: string) => {
    if (!draft) return
    const el = bodyRef.current
    const at = el?.selectionStart ?? draft.body.length
    setDraft({ ...draft, body: `${draft.body.slice(0, at)}{{${tag}}}${draft.body.slice(el?.selectionEnd ?? at)}` })
  }

  return (
    <div className="stack">
      {message ? <p className="text-muted" role="alert">{message}</p> : null}
      <div className="cluster">
        {pushState === 'unsupported' ? (
          <span className="text-muted">This browser cannot receive push notifications.</span>
        ) : pushState === 'on' ? (
          <>
            <span className="text-muted">Push is on for this browser.</span>
            <button type="button" className="btn" onClick={turnOffPush}>Turn off</button>
          </>
        ) : (
          <button type="button" className="btn" onClick={turnOnPush}>Turn on push in this browser</button>
        )}
      </div>
      {data.rules.length === 0 && !draft ? <p className="text-muted">No notifications yet. Add one to send an email or push when something happens.</p> : null}
      {data.rules.map((rule) => (
        <div className="card" key={rule.id}>
          <div className="card-body cluster">
            <div>
              <strong>{rule.name}</strong>
              <br />
              <span className="text-muted">
                {data.triggers.find((t) => t.key === rule.event)?.label ?? rule.event} then {rule.channel === 'push' ? 'push to admins' : `email ${RECIPIENT_LABEL[rule.recipient]?.toLowerCase() ?? ''}`}
                {rule.enabled ? '' : ' (off)'}
              </span>
            </div>
            <button type="button" className="btn" onClick={() => setDraft(rule)}>Edit</button>
            <button type="button" className="btn" disabled={busy} onClick={() => post({ rule: { ...rule, enabled: !rule.enabled } })}>{rule.enabled ? 'Turn off' : 'Turn on'}</button>
            <button type="button" className="btn" disabled={busy} onClick={() => post({ action: 'delete', id: rule.id })}>Delete</button>
          </div>
        </div>
      ))}
      {draft ? (
        <div className="card">
          <div className="card-body stack">
            <label className="field">Name<input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="field">When this happens
              <select className="select" value={draft.event} onChange={(e) => setDraft({ ...draft, event: e.target.value, recipient: 'admin' })}>
                {data.triggers.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
            <label className="field">Send as
              <select className="select" value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as 'email' | 'push' })}>
                <option value="email">Email</option>
                <option value="push">Push notification</option>
              </select>
            </label>
            {draft.channel === 'email' ? (
              <label className="field">Send to
                <select className="select" value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })}>
                  {(trigger?.recipients ?? ['admin']).map((r) => <option key={r} value={r}>{RECIPIENT_LABEL[r]}</option>)}
                </select>
              </label>
            ) : null}
            {draft.channel === 'email' && draft.recipient === 'custom' ? (
              <label className="field">Email address<input className="input" type="email" value={draft.customTo} onChange={(e) => setDraft({ ...draft, customTo: e.target.value })} /></label>
            ) : null}
            <label className="field">{draft.channel === 'push' ? 'Title' : 'Subject'}<input className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
            {draft.channel === 'email' ? (
              <label className="field">Look of the email
                <select className="select" value={draft.layout} onChange={(e) => setDraft({ ...draft, layout: e.target.value === 'brand' ? 'brand' : 'plain' })}>
                  <option value="brand">Designed: your logo, colours and footer from Email design</option>
                  <option value="plain">Plain paragraphs</option>
                </select>
                <span className="hint">The designed look is used once the brand is switched on in Email design; until then the email stays plain. In the message, **bold** and [link text](https://example.com) work.</span>
              </label>
            ) : null}
            <label className="field">Message<textarea ref={bodyRef} className="textarea" rows={6} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
            <div className="cluster">
              <span className="text-muted">Merge tags:</span>
              {(data.tags[draft.event] ?? []).map((t) => (
                <button type="button" className="badge" key={t.tag} title={t.label} onClick={() => insertTag(t.tag)}>{`{{${t.tag}}}`}</button>
              ))}
            </div>
            <div className="cluster">
              <button type="button" className="btn" disabled={busy} onClick={async () => { if (await post({ rule: draft })) setDraft(null) }}>Save</button>
              <button type="button" className="btn" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <div><button type="button" className="btn" onClick={() => setDraft(blank(data.triggers[0]?.key ?? 'order.paid'))}>Add notification</button></div>
      )}
    </div>
  )
}
