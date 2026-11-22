'use client'
import React, { useEffect, useState } from 'react'

import { num, str } from './elementUtil'
import './wave68.css'

/** Wave 68 client elements (Task 10): world-clock, progress-tracker, dark-mode-toggle (defs: wave68Defs.ts). */

type P = Record<string, unknown>
export type Zone = { city: string; tz: string }

const MAX_ZONES = 12

export const validZone = (tz: string): boolean => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

/** "City | Time zone" lines. Rows without a valid IANA zone are skipped. */
export function parseZones(v: unknown): Zone[] {
  const out: Zone[] = []
  for (const line of str(v).split('\n')) {
    const [city = '', tz = ''] = line.split('|').map((s) => s.trim())
    if (city && tz && validZone(tz)) out.push({ city, tz })
    if (out.length === MAX_ZONES) break
  }
  return out
}

/** Hour, minute, second in a zone. */
export function zoneTime(now: Date, tz: string): { h: number; m: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(now)
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return { h: g('hour') % 24, m: g('minute'), s: g('second') }
}

export function formatClock(t: { h: number; m: number; s: number }, hour12: boolean, seconds: boolean): string {
  const two = (n: number) => String(n).padStart(2, '0')
  const h = hour12 ? t.h % 12 || 12 : t.h
  const suffix = hour12 ? (t.h < 12 ? ' AM' : ' PM') : ''
  return `${hour12 ? h : two(h)}:${two(t.m)}${seconds ? `:${two(t.s)}` : ''}${suffix}`
}

/** Hand angles in degrees for an analogue face. */
export function handAngles(t: { h: number; m: number; s: number }): { hour: number; minute: number; second: number } {
  return { hour: ((t.h % 12) + t.m / 60) * 30, minute: (t.m + t.s / 60) * 6, second: t.s * 6 }
}

function Face({ t, label }: { t: { h: number; m: number; s: number }; label: string }) {
  const a = handAngles(t)
  const hand = (deg: number, len: number, w: number, cls: string) => (
    <line className={cls} x1="50" y1="50" x2="50" y2={50 - len} strokeWidth={w} strokeLinecap="round" transform={`rotate(${deg} 50 50)`} />
  )
  return (
    <svg className="be-el-68-face" viewBox="0 0 100 100" role="img" aria-label={label}>
      <circle cx="50" cy="50" r="47" className="be-el-68-rim" />
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1="50" y1="6" x2="50" y2={i % 3 === 0 ? 13 : 10} className="be-el-68-tick" transform={`rotate(${i * 30} 50 50)`} />)}
      {hand(a.hour, 24, 3.5, 'be-el-68-hand')}
      {hand(a.minute, 34, 2.5, 'be-el-68-hand')}
      {hand(a.second, 38, 1, 'be-el-68-sec')}
    </svg>
  )
}

export function WorldClockElement(props: P) {
  const zones = parseZones(props.zones)
  const analogue = str(props.style) === 'analogue'
  const hour12 = str(props.hour12) === '12'
  const seconds = props.showSeconds !== false
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!zones.length) return null
  return (
    <ul className="be-el-68-clocks">
      {zones.map((z) => {
        const t = now ? zoneTime(now, z.tz) : null
        const text = t ? formatClock(t, hour12, seconds) : '--:--'
        const date = now && props.showDate === true ? new Intl.DateTimeFormat(undefined, { timeZone: z.tz, weekday: 'short', day: 'numeric', month: 'short' }).format(now) : ''
        return (
          <li key={`${z.city}|${z.tz}`} className="be-el-68-clock">
            {analogue && t ? <Face t={t} label={`${z.city} ${text}`} /> : null}
            <span className="be-el-68-city">{z.city}</span>
            {!analogue || !t ? <span className="be-el-68-time" suppressHydrationWarning>{text}</span> : null}
            {date ? <span className="be-el-68-date">{date}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Index (0 based) of the current step, clamped. A query parameter overrides the number when it holds an integer. */
export function currentStep(total: number, base: unknown, param: string, search: string): number {
  let n = Math.trunc(num(base, 1))
  if (param) {
    const raw = new URLSearchParams(search).get(param)
    if (raw !== null && /^\d{1,3}$/.test(raw)) n = Number(raw)
  }
  return Math.min(Math.max(n, 1), Math.max(total, 1)) - 1
}

export function ProgressTrackerElement(props: P) {
  const steps = str(props.steps).split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20)
  const param = str(props.currentFromUrl).trim()
  const [search, setSearch] = useState('')
  useEffect(() => { if (param) setSearch(window.location.search) }, [param])
  if (!steps.length) return null
  const cur = currentStep(steps.length, props.current, param, search)
  const vertical = str(props.direction) === 'vertical'
  return (
    <ol className={`be-el-68-steps${vertical ? ' be-el-68-steps--v' : ''}`} aria-label="Progress">
      {steps.map((s, i) => (
        <li key={`${i}-${s}`} className={`be-el-68-step${i < cur ? ' is-done' : ''}${i === cur ? ' is-current' : ''}`} aria-current={i === cur ? 'step' : undefined}>
          <span className="be-el-68-dot">{i < cur ? '✓' : i + 1}</span>
          <span className="be-el-68-steplabel">{s}</span>
        </li>
      ))}
    </ol>
  )
}

const KEY = 'be-theme'

export function DarkModeToggleElement(props: P) {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem(KEY) } catch { /* storage blocked */ }
    const initial = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(initial)
    if (saved) document.documentElement.setAttribute('data-theme', saved)
  }, [])
  const label = str(props.label) || 'Dark mode'
  const toggle = () => {
    const next = !dark
    setDark(next)
    const v = next ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', v)
    try { localStorage.setItem(KEY, v) } catch { /* storage blocked */ }
  }
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label={label} className="be-el-68-toggle" onClick={toggle}>
      <span className="be-el-68-track"><span className="be-el-68-thumb" /></span>
      {props.showLabel === true ? <span>{label}</span> : null}
    </button>
  )
}

export const WAVE68_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  'world-clock': WorldClockElement,
  'progress-tracker': ProgressTrackerElement,
  'dark-mode-toggle': DarkModeToggleElement,
}
