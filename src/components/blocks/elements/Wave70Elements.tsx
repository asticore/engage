'use client'
import React, { useEffect, useState } from 'react'

import { num, str } from './elementUtil'
import './wave70.css'

/** Wave 70 client element (Task 10): age-gate. Defs: wave70Defs.ts. */

type P = Record<string, unknown>
const KEY = 'be-age-ok'
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|lighthouse|headless/i

/** Whole years between a birth date (YYYY-MM-DD) and now. Null for an invalid or future date. */
export function ageOn(dob: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const born = new Date(Date.UTC(y, mo - 1, d))
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== mo - 1 || born.getUTCDate() !== d || born > now) return null
  let age = now.getUTCFullYear() - y
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) age -= 1
  return age
}

/** Only https addresses and same-site paths are followed. */
export function safeDeny(url: string): string {
  const u = url.trim()
  if (/^\/(?!\/)/.test(u)) return u
  try { return new URL(u).protocol === 'https:' ? u : '' } catch { return '' }
}

export function AgeGateElement(props: P): React.ReactElement | null {
  const [open, setOpen] = useState(false)
  const [denied, setDenied] = useState(false)
  const [dob, setDob] = useState('')
  const minAge = Math.max(1, Math.trunc(num(props.minAge, 18)))
  const days = Math.max(1, Math.trunc(num(props.rememberDays, 30)))
  useEffect(() => {
    if (BOT.test(navigator.userAgent)) return
    let ok = false
    try { const t = Number(localStorage.getItem(KEY)); ok = t > Date.now() } catch { /* storage blocked */ }
    if (!ok) setOpen(true)
  }, [])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  const pass = () => {
    try { localStorage.setItem(KEY, String(Date.now() + days * 86400000)) } catch { /* storage blocked */ }
    setOpen(false)
  }
  const fail = () => {
    const to = safeDeny(str(props.denyUrl))
    if (to) window.location.assign(to)
    else setDenied(true)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const a = ageOn(dob, new Date())
    if (a !== null && a >= minAge) pass()
    else fail()
  }
  return (
    <div className="w70-gate" role="dialog" aria-modal="true" aria-labelledby="w70-gate-h">
      <div className="w70-gate__box">
        <h2 id="w70-gate-h">{str(props.heading) || `Are you over ${minAge}?`}</h2>
        {str(props.message) ? <p>{str(props.message)}</p> : null}
        {denied ? <p role="alert">Sorry, you cannot enter this site.</p> : str(props.mode) === 'date' ? (
          <form onSubmit={submit}>
            <label>Date of birth <input type="date" required value={dob} onChange={(e) => setDob(e.target.value)} /></label>
            <button type="submit">Enter</button>
          </form>
        ) : (
          <div className="w70-gate__btns">
            <button type="button" onClick={pass}>Yes</button>
            <button type="button" onClick={fail}>No</button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Chat link for an app, or '' when the contact is not valid. WhatsApp digits only (7 to 15), others a username. */
export function chatHref(app: string, contact: string, message: string): string {
  const c = contact.trim().replace(/^@/, '')
  const text = message.trim().slice(0, 300)
  if (app === 'whatsapp') {
    const digits = c.replace(/[\s()+-]/g, '')
    if (!/^\d{7,15}$/.test(digits)) return ''
    return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
  }
  if (!/^[A-Za-z0-9._]{3,64}$/.test(c)) return ''
  if (app === 'messenger') return `https://m.me/${c}`
  if (app === 'telegram') return `https://t.me/${c}${text ? `?text=${encodeURIComponent(text)}` : ''}`
  return ''
}

/** True when `minutes` (since midnight) is inside "HH:MM-HH:MM"; an empty or malformed range is always open. Overnight ranges wrap. */
export function inChatHours(range: string, minutes: number): boolean {
  const m = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/.exec(range.trim())
  if (!m) return true
  const from = Number(m[1]) * 60 + Number(m[2]), to = Number(m[3]) * 60 + Number(m[4])
  return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to
}

export function ChatButtonElement(props: P): React.ReactElement | null {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const n = new Date()
    setOpen(inChatHours(str(props.hours), n.getHours() * 60 + n.getMinutes()))
  }, [props.hours])
  const href = chatHref(str(props.app), str(props.contact), str(props.message))
  if (!href || !open) return null
  return (
    <a className={`w70-chat${props.floating === true ? ' w70-chat--float' : ''}`} href={href} target="_blank" rel="noopener noreferrer">
      {str(props.label) || 'Chat with us'}
    </a>
  )
}

const SPINNERS = ['ring', 'dots', 'bars', 'pulse', 'orbit', 'wave', 'square']
const HEX = /^#[0-9a-fA-F]{3,8}$/

export function PreloaderElement(props: P): React.ReactElement | null {
  const [state, setState] = useState<'off' | 'on' | 'fading'>('off')
  const minMs = Math.min(Math.max(Math.trunc(num(props.minMs, 400)), 0), 5000)
  useEffect(() => {
    if (BOT.test(navigator.userAgent) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setState('on')
    const started = Date.now()
    const done = () => {
      setTimeout(() => { setState('fading'); setTimeout(() => setState('off'), 300) }, Math.max(0, minMs - (Date.now() - started)))
    }
    if (document.readyState === 'complete') done()
    else window.addEventListener('load', done, { once: true })
    return () => window.removeEventListener('load', done)
  }, [minMs])
  if (state === 'off') return null
  const bg = HEX.test(str(props.background)) ? str(props.background) : '#ffffff'
  const type = SPINNERS.includes(str(props.spinner)) ? str(props.spinner) : 'ring'
  return (
    <div className={`w70-preloader${state === 'fading' ? ' is-fading' : ''}`} style={{ background: bg }} role="status" aria-live="polite">
      <span className="spark-spinner" data-spark-type={type} data-spark-label="Loading" />
    </div>
  )
}

export const WAVE70_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  'age-gate': AgeGateElement,
  'chat-button': ChatButtonElement,
  preloader: PreloaderElement,
}
