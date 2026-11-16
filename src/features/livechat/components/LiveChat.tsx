'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { AuthCaptcha } from '@/features/security/AuthCaptcha'

type Msg = { id: number; sender: 'visitor' | 'staff'; name: string; content: string }
type Status = { available: boolean; welcome: string; offlineMessage: string; chat?: { status: 'open' | 'closed' | 'offline'; name: string; hasEmail: boolean }; messages?: Msg[] }

const KEY = 'eg_live_token'
const read = (k: string): string => {
  try {
    return sessionStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
const save = (k: string, v: string): void => {
  try {
    if (v) sessionStorage.setItem(k, v)
    else sessionStorage.removeItem(k)
  } catch {
    // The chat still works until the page is reloaded.
  }
}

const POLL_MS = 4000

/**
 * Talk to a person, inside the chatbot widget. While staff are online it is a live chat that polls for replies every few seconds;
 * otherwise a short form turns the message into an email to the team. English labels only for now.
 */
export const LiveChat: React.FC<{ captcha: { provider: 'turnstile' | 'recaptcha'; siteKey: string } | null; onBack: () => void }> = ({ captcha, onBack }) => {
  const [status, setStatus] = useState<Status | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const token = useRef(read(KEY))
  const last = useRef(0)
  const [hasChat, setHasChat] = useState(Boolean(token.current))
  const log = useRef<HTMLDivElement>(null)

  const poll = useCallback(async () => {
    const res = await fetch(`/api/livechat?token=${encodeURIComponent(token.current)}&after=${last.current}`, { cache: 'no-store' }).catch((): null => null)
    if (!res || !res.ok) return
    const out = (await res.json().catch((): null => null)) as Status | null
    if (!out) return
    setStatus(out)
    if (token.current && !out.chat) {
      token.current = ''
      save(KEY, '')
      setHasChat(false)
    }
    if (out.messages && out.messages.length > 0) {
      last.current = out.messages[out.messages.length - 1]!.id
      setMessages((prev) => [...prev, ...out.messages!.filter((m) => !prev.some((p) => p.id === m.id))])
    }
  }, [])
  useEffect(() => {
    void poll()
    const t = setInterval(() => void poll(), POLL_MS)
    return () => clearInterval(t)
  }, [poll])
  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight })
  }, [messages])

  const call = async (body: Record<string, unknown>): Promise<{ ok?: boolean; token?: string; status?: string; message?: string; error?: string; ended?: boolean } | null> => {
    const res = await fetch('/api/livechat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch((): null => null)
    return res ? ((await res.json().catch((): null => null)) as { ok?: boolean; error?: string } | null) : null
  }

  if (!status) return <p style={{ padding: '1rem' }}>Checking who is available…</p>
  const ended = status.chat?.status === 'closed'
  const form = !hasChat || ended

  const start = async (f: HTMLFormElement): Promise<void> => {
    const d = new FormData(f)
    setBusy(true)
    setError('')
    const payload: Record<string, unknown> = { action: 'start', message: d.get('message'), name: d.get('name') ?? '', email: d.get('email') ?? '', website: d.get('website') ?? '', botToken: read('eg_chat_token') }
    for (const k of ['cf-turnstile-response', 'g-recaptcha-response']) if (d.get(k)) payload[k] = d.get(k)
    const out = await call(payload)
    setBusy(false)
    if (!out?.ok || !out.token) return setError(out?.error ?? 'That did not work. Please try again.')
    f.reset()
    if (out.status === 'offline') return setInfo(out.message ?? 'Thanks. We will reply by email.')
    token.current = out.token
    save(KEY, out.token)
    last.current = 0
    setMessages([])
    setHasChat(true)
    void poll()
  }
  const send = async (f: HTMLFormElement): Promise<void> => {
    const message = String(new FormData(f).get('message') ?? '').trim()
    if (!message || busy) return
    setBusy(true)
    setError('')
    const out = await call({ action: 'send', token: token.current, message })
    setBusy(false)
    if (!out?.ok) {
      if (out?.ended) setStatus({ ...status, chat: { ...(status.chat as NonNullable<Status['chat']>), status: 'closed' } })
      return setError(out?.error ?? 'That did not work. Please try again.')
    }
    f.reset()
    void poll()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <p style={{ margin: 0, padding: '0.5rem 0.75rem' }}>
        <button type="button" onClick={onBack}>
          ← Back to the assistant
        </button>
      </p>
      {info ? (
        <p role="status" style={{ padding: '0.75rem' }}>
          {info}
        </p>
      ) : form ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void start(e.currentTarget)
          }}
          style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', overflowY: 'auto' }}
        >
          <p style={{ margin: 0 }}>{ended ? 'This chat has ended. Start a new one below.' : status.available ? status.welcome : status.offlineMessage}</p>
          <label>
            Your name{status.available ? ' (optional)' : ''}
            <br />
            <input name="name" required={!status.available} maxLength={60} autoComplete="name" style={{ width: '100%' }} />
          </label>
          <label>
            Email{status.available ? ' (optional, lets us reply if you leave)' : ''}
            <br />
            <input name="email" type="email" required={!status.available} maxLength={200} autoComplete="email" style={{ width: '100%' }} />
          </label>
          <label>
            Message
            <br />
            <textarea name="message" required rows={3} maxLength={1000} style={{ width: '100%' }} />
          </label>
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {captcha ? <AuthCaptcha provider={captcha.provider} siteKey={captcha.siteKey} /> : null}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {status.available ? 'Start chat' : 'Send message'}
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      ) : (
        <>
          <div ref={log} role="log" aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
            <p style={{ margin: 0 }}>{status.chat?.status === 'offline' ? 'Your message was sent. We will reply by email, and you can also add more here.' : status.welcome}</p>
            {messages.map((m) => (
              <div key={m.id} style={{ justifySelf: m.sender === 'visitor' ? 'end' : 'start', maxWidth: '85%', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', background: m.sender === 'visitor' ? 'var(--color-primary, #1d4ed8)' : 'var(--color-line, #eee)', color: m.sender === 'visitor' ? 'var(--color-on-primary, #fff)' : 'inherit' }}>
                {m.sender === 'staff' && m.name ? <strong style={{ display: 'block' }}>{m.name}</strong> : null}
                <span style={{ whiteSpace: 'pre-line' }}>{m.content}</span>
              </div>
            ))}
            {error && <p role="alert">{error}</p>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send(e.currentTarget)
            }}
            style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid var(--color-line, #ccc)' }}
          >
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label style={{ flex: 1 }}>
                <span style={{ position: 'absolute', left: '-9999px' }}>Your message</span>
                <input name="message" required maxLength={1000} placeholder="Type your message" autoComplete="off" style={{ width: '100%' }} />
              </label>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                Send
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              {status.chat?.hasEmail && (
                <button
                  type="button"
                  onClick={async () => setInfo((await call({ action: 'transcript', token: token.current }))?.ok ? 'Transcript sent to your email.' : 'Could not send the transcript.')}
                >
                  Email me this chat
                </button>
              )}{' '}
              <button
                type="button"
                onClick={async () => {
                  await call({ action: 'end', token: token.current })
                  save(KEY, '')
                  token.current = ''
                  setHasChat(false)
                  setMessages([])
                  last.current = 0
                }}
              >
                End chat
              </button>
            </p>
          </form>
        </>
      )}
    </div>
  )
}
