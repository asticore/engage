'use client'

import React, { useEffect, useRef, useState } from 'react'

import { AuthCaptcha } from '@/features/security/AuthCaptcha'

import { LiveChat } from '@/features/livechat/components/LiveChat'

import type { Handoff } from '../core'

type Config = { live: boolean; sitewide: boolean; position: 'left' | 'right'; name: string; avatar: string; greeting: string; requireConsent: boolean; consentText: string; hours: string; captcha: { provider: 'turnstile' | 'recaptcha'; siteKey: string } | null }
type Line = { id: number; role: 'user' | 'assistant'; text: string; sources?: Array<{ title: string; url: string }>; handoff?: Handoff | null; messageId?: number; rated?: 1 | -1 }

const TOKEN_KEY = 'eg_chat_token'
const readToken = (): string => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}
const saveToken = (t: string): void => {
  try {
    sessionStorage.setItem(TOKEN_KEY, t)
  } catch {
    // The chat still works, it just starts a new conversation on reload.
  }
}

/**
 * The site chatbot. `inline` renders the chat box in the page (the visual editor element); otherwise a button opens a panel
 * in the corner, shown only when the admin switched "show on every page" on. English labels only for now.
 */
export const ChatWidget: React.FC<{ inline?: boolean }> = ({ inline = false }) => {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [open, setOpen] = useState(inline)
  const [lines, setLines] = useState<Line[]>([])
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState(false)
  const [error, setError] = useState('')
  const token = useRef('')
  const next = useRef(1)
  const input = useRef<HTMLInputElement>(null)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    token.current = readToken()
    void fetch('/api/chatbot')
      .then((r) => (r.ok ? (r.json() as Promise<Config>) : null))
      .then((c) => {
        setCfg(c)
        if (c && !c.requireConsent) setAgreed(true)
      })
      .catch(() => setCfg(null))
  }, [])
  useEffect(() => {
    if (open && agreed) input.current?.focus()
  }, [open, agreed])
  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight })
  }, [lines])

  if (!cfg || (!inline && !cfg.sitewide)) return null

  const ask = async (form: HTMLFormElement): Promise<void> => {
    const data = new FormData(form)
    const message = String(data.get('message') ?? '').trim()
    if (!message || busy) return
    setBusy(true)
    setError('')
    const history = lines.slice(-6).map((l) => ({ role: l.role, content: l.text }))
    setLines((p) => [...p, { id: next.current++, role: 'user', text: message }])
    form.reset()
    const payload: Record<string, unknown> = { action: 'ask', message, history, token: token.current, website: data.get('website') ?? '' }
    for (const k of ['cf-turnstile-response', 'g-recaptcha-response']) if (data.get(k)) payload[k] = data.get(k)
    try {
      const res = await fetch('/api/chatbot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const out = (await res.json().catch((): null => null)) as { ok?: boolean; answer?: string; sources?: Line['sources']; handoff?: Handoff | null; messageId?: number; token?: string; error?: string } | null
      if (!res.ok || !out?.ok) {
        setError(out?.error ?? 'That did not work. Please try again.')
      } else {
        if (out.token) {
          token.current = out.token
          saveToken(out.token)
        }
        setLines((p) => [...p, { id: next.current++, role: 'assistant', text: out.answer ?? '', sources: out.sources, handoff: out.handoff, messageId: out.messageId }])
      }
    } catch {
      setError('Could not reach the assistant. Please try again.')
    }
    setBusy(false)
  }

  const rate = async (line: Line, rating: 1 | -1): Promise<void> => {
    if (!line.messageId || line.rated) return
    setLines((p) => p.map((l) => (l.id === line.id ? { ...l, rated: rating } : l)))
    await fetch('/api/chatbot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rate', token: token.current, messageId: line.messageId, rating }) }).catch((): null => null)
  }

  const panel = (
    <section aria-label={`Chat with ${cfg.name}`} style={{ display: 'flex', flexDirection: 'column', width: inline ? '100%' : 'min(22rem, calc(100vw - 2rem))', maxWidth: inline ? '36rem' : undefined, height: inline ? '28rem' : 'min(32rem, calc(100vh - 6rem))', background: 'var(--color-bg, #fff)', color: 'var(--color-text, #111)', border: '1px solid var(--color-line, #ccc)', borderRadius: '0.75rem', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderBottom: '1px solid var(--color-line, #ccc)' }}>
        {cfg.avatar ? (
          <img src={cfg.avatar} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <span aria-hidden="true" style={{ width: 32, height: 32, lineHeight: '32px', textAlign: 'center', borderRadius: '50%', background: 'var(--color-line, #ddd)' }}>
            {cfg.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <strong style={{ flex: 1 }}>{cfg.name}</strong>
        {cfg.live && agreed && !live && (
          <button type="button" onClick={() => setLive(true)}>
            Talk to a person
          </button>
        )}
        {!inline && (
          <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}>
            ×
          </button>
        )}
      </header>
      {!agreed ? (
        <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
          <p style={{ margin: 0 }}>{cfg.consentText}</p>
          <button type="button" className="btn btn--primary" onClick={() => setAgreed(true)}>
            I agree, start chat
          </button>
        </div>
      ) : live ? (
        <LiveChat captcha={cfg.captcha} onBack={() => setLive(false)} />
      ) : (
        <>
          <div ref={log} role="log" aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
            <p style={{ margin: 0 }}>{cfg.greeting}</p>
            {lines.map((l) => (
              <div key={l.id} style={{ justifySelf: l.role === 'user' ? 'end' : 'start', maxWidth: '85%', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', background: l.role === 'user' ? 'var(--color-primary, #1d4ed8)' : 'var(--color-line, #eee)', color: l.role === 'user' ? 'var(--color-on-primary, #fff)' : 'inherit' }}>
                <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{l.text}</p>
                {l.sources && l.sources.length > 0 && (
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
                    {l.sources.map((s) => (
                      <li key={s.url}>
                        <a href={s.url}>{s.title}</a>
                      </li>
                    ))}
                  </ul>
                )}
                {l.handoff && (
                  <p style={{ margin: '0.5rem 0 0' }}>
                    {cfg.live ? (
                      <>
                        <button type="button" onClick={() => setLive(true)}>
                          Talk to a person
                        </button>{' '}
                      </>
                    ) : null}
                    <a href={l.handoff.url}>Contact us</a>
                    {l.handoff.email ? (
                      <>
                        {' or '}
                        <a href={`mailto:${l.handoff.email}`}>{l.handoff.email}</a>
                      </>
                    ) : null}
                    {l.handoff.hours ? <span> ({l.handoff.hours})</span> : null}
                  </p>
                )}
                {l.role === 'assistant' && l.messageId ? (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                    <button type="button" aria-label="Helpful" aria-pressed={l.rated === 1} disabled={Boolean(l.rated)} onClick={() => void rate(l, 1)}>
                      👍
                    </button>{' '}
                    <button type="button" aria-label="Not helpful" aria-pressed={l.rated === -1} disabled={Boolean(l.rated)} onClick={() => void rate(l, -1)}>
                      👎
                    </button>
                  </p>
                ) : null}
              </div>
            ))}
            {busy && <p style={{ margin: 0 }}>Typing…</p>}
            {error && (
              <p role="alert" style={{ margin: 0 }}>
                {error}
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void ask(e.currentTarget)
            }}
            style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid var(--color-line, #ccc)' }}
          >
            {cfg.captcha ? <AuthCaptcha provider={cfg.captcha.provider} siteKey={cfg.captcha.siteKey} /> : null}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label style={{ flex: 1 }}>
                <span className="sr-only" style={{ position: 'absolute', left: '-9999px' }}>
                  Your question
                </span>
                <input ref={input} name="message" required maxLength={500} placeholder="Type your question" autoComplete="off" style={{ width: '100%' }} />
              </label>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )

  if (inline) return panel
  return (
    <div style={{ position: 'fixed', bottom: '1rem', [cfg.position]: '1rem', zIndex: 60 }}>
      {open ? (
        panel
      ) : (
        <button type="button" className="btn btn--primary" aria-label={`Open chat with ${cfg.name}`} onClick={() => setOpen(true)}>
          Chat
        </button>
      )}
    </div>
  )
}
