import React from 'react'

import { EmbedConsentFrame } from './EmbedConsentFrame'
import { embedLayout, parseAudioEmbedUrl } from '@/lib/embedProviders'
import { safeUrl } from '@/lib/mergeTags'
import { LANGS, parsePlaylist, tokenize } from '@/lib/elements/wave64Util'

import { flag, mediaOf, parseVideoUrl, pick, str } from './elementUtil'
import { BillingToggle } from './BillingToggle'
import { LottieClient } from './LottieClient'
import { CopyButton, ImageAccordion, VideoPlaylist } from './Wave64Client'
import type { Panel } from './Wave64Client'
import './wave48.css'
import './wave64.css'

/** Wave 64 renderers (src/lib/elements/wave64Defs.ts). All text is React text, so it is escaped. */

type P = Record<string, unknown>

export const AudioElement: React.FC<P> = (p) => {
  const embed = mediaOf(p.file)?.url ? null : parseAudioEmbedUrl(str(p.url))
  if (embed) {
    const name = embed.kind === 'spotify' ? 'Spotify' : 'SoundCloud'
    return (
      <figure className="be-el-64-audio">
        <EmbedConsentFrame
          src={embed.src}
          title={str(p.title, 'Audio') || name}
          providerName={name}
          aspectRatio="16 / 9"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          allow="encrypted-media; clipboard-write"
          {...embedLayout(embed.kind, embed.src)}
        />
      </figure>
    )
  }
  const src = mediaOf(p.file)?.url || mediaOf(p.url)?.url
  if (!src) return <div className="el-placeholder">Choose an audio file</div>
  const title = str(p.title, 'Audio')
  return (
    <figure className="be-el-64-audio">
      {title && <figcaption>{title}</figcaption>}
      <audio src={src} controls preload="none" loop={flag(p.loop)} aria-label={title || 'Audio'} />
    </figure>
  )
}

export const CodeHighlightElement: React.FC<P> = (p) => {
  const code = str(p.code).replace(/\s+$/, '')
  if (!code) return <div className="el-placeholder">Add some code</div>
  const lang = pick(p.language, LANGS, 'js')
  const toks = tokenize(code, lang)
  const nums = flag(p.lineNumbers, true)
  const count = code.split('\n').length
  return (
    <div className="be-el-64-code">
      {flag(p.copy, true) && <CopyButton text={code} />}
      <pre tabIndex={0} aria-label={`${lang} code`}>
        {nums && (
          <span className="be-el-64-code__nums" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => i + 1).join('\n')}
          </span>
        )}
        <code>
          {toks.map((t, i) => (t.t === 'plain' ? t.v : <span key={i} className={`be-tok-${t.t}`}>{t.v}</span>))}
        </code>
      </pre>
    </div>
  )
}

export const ImageAccordionElement: React.FC<P> = (p) => {
  const raw = Array.isArray(p.panels) ? (p.panels as P[]) : []
  const panels: Panel[] = []
  for (const r of raw.slice(0, 6)) {
    const url = mediaOf(r?.image)?.url || safeUrl(str(r?.url))
    if (!url) continue
    const href = str(r?.link).trim()
    panels.push({ url, title: str(r?.title), alt: str(r?.alt), href: href ? safeUrl(href) || '' : '' })
  }
  if (panels.length < 2) return <div className="el-placeholder">Add at least two panels with pictures</div>
  return <ImageAccordion panels={panels} height={Math.min(700, Math.max(200, Number(p.height) || 360))} />
}

export const VideoPlaylistElement: React.FC<P> = (p) => {
  const items = parsePlaylist(str(p.items), (u) => parseVideoUrl(u) ?? parseAudioEmbedUrl(u))
  if (items.length === 0) return <div className="el-placeholder">Add video links, one per line</div>
  return <VideoPlaylist items={items} label={str(p.label, 'Video playlist')} />
}

/** `lottie-player`: a native Lottie animation (.lottie or .json file). Loads its player only when in view. */
export const LottiePlayerElement: React.FC<P> = (p) => {
  const url = safeUrl(str(p.url)) ?? mediaOf(p.file)?.url
  if (!url || !/^(https?:\/\/|\/)/.test(url)) return <div className="el-placeholder">Add a Lottie file (.lottie or .json)</div>
  const mode = pick(p.mode, ['autoplay', 'hover', 'scroll'] as const, 'autoplay')
  const height = Math.min(1000, Math.max(40, Number(p.height) || 300))
  return <LottieClient src={url} mode={mode} loop={flag(p.loop, true)} label={str(p.label, 'Animation')} height={height} />
}

/** `billing-toggle`: a monthly and yearly switch that flips every pricing table on the page that has a yearly price. */
export const BillingToggleElement: React.FC<P> = (p) => (
  <BillingToggle monthlyLabel={str(p.monthlyLabel, 'Monthly')} yearlyLabel={str(p.yearlyLabel, 'Yearly')} saveText={str(p.saveText)} startYearly={flag(p.startYearly, false)} />
)

/** `before-after`: two pictures with a drag handle (Spark `spark-compare` builds the clip, handle and slider). Without scripts the first picture shows. */
export const BeforeAfterElement: React.FC<P> = (p) => {
  const before = mediaOf(p.before)?.url || safeUrl(str(p.beforeUrl))
  const after = mediaOf(p.after)?.url || safeUrl(str(p.afterUrl))
  if (!before || !after) return <div className="el-placeholder">Choose a before and an after picture</div>
  const start = Math.min(100, Math.max(0, Number.isFinite(Number(p.start)) && p.start !== undefined && p.start !== '' ? Number(p.start) : 50))
  return (
    <div className="spark-compare be-el-compare" data-spark-start={start} data-spark-vertical={flag(p.vertical) ? 'true' : undefined} data-spark-hover={flag(p.hover) ? 'true' : undefined}>
      <img src={before} alt={str(p.beforeAlt, 'Before')} loading="lazy" decoding="async" />
      <img src={after} alt={str(p.afterAlt, 'After')} loading="lazy" decoding="async" />
    </div>
  )
}

/**
 * `popup`: a Shine modal (`dialog.modal`) that Spark's `spark-popup` opens from the button (`data-spark-open`) or on a
 * timer, scroll depth or exit intent. Spark remembers when it showed (session, days or once). Text is React text.
 */
export const PopupElement: React.FC<P> = (p) => {
  const uid = `eg-popup-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const title = str(p.title)
  const paragraphs = str(p.body).split(/\n{2,}/).map((t) => t.trim()).filter(Boolean)
  const image = mediaOf(p.image)?.url
  const label = str(p.buttonLabel).trim()
  const ctaUrl = safeUrl(str(p.ctaUrl).trim())
  const ctaLabel = str(p.ctaLabel).trim()
  const num = (v: unknown, d: number) => (v === undefined || v === '' || !Number.isFinite(Number(v)) ? d : Number(v))
  const delay = Math.max(0, num(p.delay, 0))
  const scroll = Math.min(100, Math.max(0, num(p.scroll, 0)))
  const frequency = pick(p.frequency, ['always', 'session', 'days', 'once'] as const, 'session')
  const close = str(p.closeLabel, 'Close') || 'Close'
  if (!label && !title && paragraphs.length === 0) return <div className="el-placeholder">Add popup text</div>
  return (
    <div className="be-el-popup">
      {label && <button type="button" className="btn" data-spark-open={uid} aria-haspopup="dialog">{label}</button>}
      <dialog
        id={uid}
        className="modal spark-popup"
        aria-label={title || label || 'Popup'}
        data-spark-delay={delay > 0 ? delay : undefined}
        data-spark-scroll={scroll > 0 ? scroll : undefined}
        data-spark-exit={flag(p.exit) ? 'true' : undefined}
        data-spark-frequency={frequency}
        data-spark-days={frequency === 'days' ? Math.max(1, num(p.days, 7)) : undefined}
        data-spark-id={uid}
      >
        <div className="modal-header">
          {title && <h2 className="modal-title">{title}</h2>}
          <button type="button" className="btn" data-spark-close aria-label={close}>{'\u00d7'}</button>
        </div>
        <div className="modal-body">
          {image && <img src={image} alt="" loading="lazy" decoding="async" style={{ maxWidth: '100%', height: 'auto' }} />}
          {paragraphs.map((t, i) => <p key={i}>{t}</p>)}
          {ctaUrl && ctaLabel && <a className="btn" href={ctaUrl}>{ctaLabel}</a>}
        </div>
      </dialog>
    </div>
  )
}

export const WAVE64_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'billing-toggle': BillingToggleElement,
  'before-after': BeforeAfterElement,
  popup: PopupElement,
  'lottie-player': LottiePlayerElement,
  audio: AudioElement,
  'code-highlight': CodeHighlightElement,
  'image-accordion': ImageAccordionElement,
  'video-playlist': VideoPlaylistElement,
}
