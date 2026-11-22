'use client'
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { linkHref, mediaOf, num, str } from './elementUtil'
import { MAX_SLIDES, shouldLoad, slidesSettings, stepIndex, textAnimationOf, videoSrc, type TextAnimation } from '@/lib/elements/slidesLogic'
import './wave65.css'

/** Wave 65 client elements: business-hours and slides (defs: src/lib/elements/wave65Defs.ts). */

type P = Record<string, unknown>
export type HoursRow = { day: string; open: string; close: string; closed: boolean }

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_NAMES: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/

export const parseTime = (v: string): number | null => {
  const m = TIME.exec(v.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Weekday key and minutes since midnight for an instant, in an IANA zone (or the local zone when empty/invalid). */
export function zonedParts(now: Date, tz?: string): { day: (typeof DAY_KEYS)[number]; minutes: number } {
  const get = (zone?: string) => {
    const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...(zone ? { timeZone: zone } : {}) }).formatToParts(now)
    const p = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
    return { day: p('weekday').slice(0, 3).toLowerCase(), minutes: (Number(p('hour')) % 24) * 60 + Number(p('minute')) }
  }
  let r: { day: string; minutes: number }
  try { r = get(tz || undefined) } catch { r = get() }
  return { day: (DAY_KEYS as readonly string[]).includes(r.day) ? (r.day as (typeof DAY_KEYS)[number]) : 'mon', minutes: r.minutes }
}

export function hoursRows(v: unknown): HoursRow[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 14).map((r) => {
    const o = (r && typeof r === 'object' ? r : {}) as P
    const day = (DAY_KEYS as readonly string[]).includes(str(o.day)) ? str(o.day) : 'mon'
    return { day, open: str(o.open), close: str(o.close), closed: o.closed === true }
  })
}

/** True when a row for today covers the current time. Overnight spans (close before open) run past midnight. */
export function isOpenNow(rows: HoursRow[], now: Date, tz?: string): boolean {
  const { day, minutes } = zonedParts(now, tz)
  const prev = DAY_KEYS[(DAY_KEYS.indexOf(day) + 6) % 7]
  return rows.some((r) => {
    if (r.closed) return false
    const o = parseTime(r.open), c = parseTime(r.close)
    if (o === null || c === null) return false
    if (r.day === day) return o <= c ? minutes >= o && minutes < c : minutes >= o
    return r.day === prev && c < o && minutes < c
  })
}

const noopSubscribe = (): (() => void) => () => undefined
const REDUCED = '(prefers-reduced-motion: reduce)'
const subscribeReduced = (cb: () => void): (() => void) => {
  const mq = window.matchMedia(REDUCED)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function BusinessHoursElement(props: P): React.ReactElement | null {
  const rows = hoursRows(props.rows)
  const tz = str(props.timezone).trim()
  const minute = useSyncExternalStore(noopSubscribe, () => Math.floor(Date.now() / 60000), () => 0)
  const now = minute ? new Date(minute * 60000) : null
  if (!rows.length) return null
  const today = now ? zonedParts(now, tz).day : ''
  const open = now ? isOpenNow(rows, now, tz) : false
  return (
    <div className="be-el-65-hours">
      {str(props.title) ? <h3 className="be-el-65-hours__title">{str(props.title)}</h3> : null}
      <table className="be-el-65-hours__table">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.day === today ? 'is-today' : undefined} aria-current={r.day === today ? 'date' : undefined}>
              <th scope="row">{DAY_NAMES[r.day]}</th>
              <td>{r.closed || !r.open || !r.close ? 'Closed' : `${r.open} - ${r.close}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {now && props.showStatus !== false ? <p className={`be-el-65-hours__status${open ? ' is-open' : ''}`}>{open ? 'Open now' : 'Closed now'}{tz ? ` (${tz})` : ''}</p> : null}
    </div>
  )
}

/** Wrap-around slide index. */
export const nextIndex = (i: number, count: number, step: number): number => (count <= 0 ? 0 : (((i + step) % count) + count) % count)

type Slide = { heading: string; text: string; label: string; href: string; image: string; alt: string; video: string; animation: TextAnimation }
const slidesOf = (v: unknown): Slide[] =>
  (Array.isArray(v) ? v : []).slice(0, MAX_SLIDES).map((s) => {
    const o = (s && typeof s === 'object' ? s : {}) as P
    const m = mediaOf(o.image) ?? mediaOf(o.imageUrl)
    return { heading: str(o.heading), text: str(o.text), label: str(o.buttonLabel), href: linkHref(o.buttonUrl), image: m?.url ?? '', alt: m?.alt ?? '', video: videoSrc(o.videoUrl), animation: textAnimationOf(o.textAnimation) }
  })

/** Extra class that hides a control on one kind of screen. */
export const deviceClass = (desktop: boolean, mobile: boolean): string => (desktop && mobile ? '' : desktop ? ' is-desktop-only' : ' is-mobile-only')

export function SlidesElement(props: P): React.ReactElement | null {
  const slides = slidesOf(props.items)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => true)
  const root = useRef<HTMLDivElement>(null)
  const count = slides.length
  const cfg = slidesSettings(props)
  const auto = props.autoplay === true && !paused && !reduced && count > 1
  const seconds = cfg.interval
  useEffect(() => {
    if (!auto) return undefined
    const t = window.setInterval(() => setIndex((i) => stepIndex(i, count, 1, true)), seconds * 1000)
    return () => window.clearInterval(t)
  }, [auto, count, seconds])
  if (count < 1) return null
  const go = (step: number) => setIndex((i) => stepIndex(i, count, step, cfg.loop))
  return (
    <>
    <div
      ref={root} className="be-el-65-slides" role="region" aria-roledescription="carousel" aria-label="Slides" tabIndex={0}
      style={{ '--slides-h': `${cfg.height}px`, '--slides-h-mobile': `${cfg.heightMobile}px` } as React.CSSProperties}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1) }}
    >
      {slides.map((s, i) => (
        <div key={i} className={`be-el-65-slides__slide${i === index ? ' is-active' : ''}`} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} aria-hidden={i === index ? undefined : true}
          style={s.image && shouldLoad(i, index, count) ? { backgroundImage: `url("${s.image.replace(/"/g, '%22')}")` } : undefined}>
          {s.video && shouldLoad(i, index, count) && !reduced ? <video className="be-el-65-slides__video" src={s.video} muted loop playsInline autoPlay={i === index} preload="metadata" aria-hidden="true" tabIndex={-1} /> : null}
          <div key={i === index ? `on-${index}` : 'off'} className={`be-el-65-slides__body${s.animation !== 'none' && i === index ? ` anim-${s.animation}` : ''}`}>
            {s.heading ? <h2>{s.heading}</h2> : null}
            {s.text ? <p>{s.text}</p> : null}
            {s.label && s.href ? <a className="be-el-65-slides__btn" href={s.href} tabIndex={i === index ? 0 : -1}>{s.label}</a> : null}
          </div>
        </div>
      ))}
      {count > 1 ? (
        <>
          {cfg.arrows || cfg.arrowsMobile ? (
            <>
              <button type="button" className={`be-el-65-slides__nav is-prev${deviceClass(cfg.arrows, cfg.arrowsMobile)}`} aria-label="Previous slide" disabled={!cfg.loop && index === 0} onClick={() => go(-1)}>{String.fromCodePoint(0x2039)}</button>
              <button type="button" className={`be-el-65-slides__nav is-next${deviceClass(cfg.arrows, cfg.arrowsMobile)}`} aria-label="Next slide" disabled={!cfg.loop && index === count - 1} onClick={() => go(1)}>{String.fromCodePoint(0x203a)}</button>
            </>
          ) : null}
          {cfg.dots || cfg.dotsMobile ? (
            <div className={`be-el-65-slides__dots${deviceClass(cfg.dots, cfg.dotsMobile)}`}>
              {slides.map((_, i) => <button key={i} type="button" aria-label={`Go to slide ${i + 1}`} aria-current={i === index ? 'true' : undefined} onClick={() => setIndex(i)} />)}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
    {cfg.thumbnails && count > 1 ? (
      <div className="be-el-65-slides__thumbs">
        {slides.map((s, i) => (
          <button key={i} type="button" aria-label={`Show slide ${i + 1}${s.heading ? `: ${s.heading}` : ''}`} aria-current={i === index ? 'true' : undefined} onClick={() => setIndex(i)}
            style={s.image ? { backgroundImage: `url("${s.image.replace(/"/g, '%22')}")` } : undefined}>{s.image ? null : s.video ? <video src={`${s.video}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} /> : i + 1}</button>
        ))}
      </div>
    ) : null}
    </>
  )
}

export const WAVE65_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  'business-hours': BusinessHoursElement,
  slides: SlidesElement,
}
