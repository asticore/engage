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

export const WAVE70_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  'age-gate': AgeGateElement,
}
