import React, { useId } from 'react'

import { safeUrl } from '@/lib/mergeTags'

import { AlertDismiss } from './AlertDismiss'
import { SocialGlyph } from './icons'
import { ShareWithPageUrl } from './ShareWithPageUrl'
import { alignClass } from './TextElements'
import { cells, flag, linkAttrs, linkHref, num, pick, str } from './elementUtil'
import { CircleProgressElement, ShareButtonsElement } from './Wave36Elements'
import { StickyBarElement } from './Wave37Elements'
import './interactive.css'

type P = Record<string, unknown>

/** Shared by `accordion` (one open at a time, via the shared name) and `toggle` (each item independent). Shine `accordion` styles it; Spark `collapse` animates the native details. */
const Disclosure: React.FC<{ p: P; exclusive: boolean }> = ({ p, exclusive }) => {
  const group = useId()
  const rows = cells(p.items, 2)
  const openFirst = flag(p.openFirst)
  return (
    <div className="accordion spark-collapse">
      {rows.map(([title, body], i) => (
        <details key={i} name={exclusive ? group : undefined} open={openFirst && i === 0}>
          <summary>{title}</summary>
          <div>{body}</div>
        </details>
      ))}
    </div>
  )
}

export const AccordionElement: React.FC<P> = (p) => <Disclosure p={p} exclusive />
export const ToggleElement: React.FC<P> = (p) => <Disclosure p={p} exclusive={false} />

const MAX_TABS = 8

/** `tabs`: CSS-only. Hidden radio inputs hold the selected tab; labels are the tab buttons. Up to 8 tabs. */
export const TabsElement: React.FC<P> = (p) => {
  const id = useId()
  const rows = cells(p.items, 2).slice(0, MAX_TABS)
  if (rows.length === 0) return null
  return (
    <div className="el-tabs">
      {rows.map((_, i) => (
        <input key={i} type="radio" name={id} id={`${id}-${i}`} className="el-tabs__radio" defaultChecked={i === 0} aria-label={rows[i][0]} />
      ))}
      <div className="el-tabs__nav">
        {rows.map(([title], i) => (
          <label key={i} htmlFor={`${id}-${i}`}>
            {title}
          </label>
        ))}
      </div>
      <div className="el-tabs__panels">
        {rows.map(([, body], i) => (
          <div className="el-tabs__panel" key={i}>
            {body}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * `counter`: a large figure with prefix, suffix and a title. Static unless `animate` is on; then the figure carries
 * Spark's `spark-counter` and counts up when it scrolls into view (asticore/spark).
 */
export const CounterElement: React.FC<P> = (p) => {
  const value = num(p.number, 0)
  const decimals = Math.round(num(p.decimals, 0, 0, 4))
  const group = flag(p.separator, true)
  const animate = flag(p.animate, false)
  const shown = value.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: group })
  const figure = animate ? (
    <span
      className="spark-counter"
      data-spark-from={num(p.start, 0)}
      data-spark-to={value}
      data-spark-duration={Math.round(num(p.duration, 1600, 200, 5000))}
      data-spark-decimals={decimals}
      data-spark-separator={group ? ',' : ''}
      data-spark-prefix={str(p.prefix) || undefined}
      data-spark-suffix={str(p.suffix) || undefined}
    >
      {shown}
    </span>
  ) : null
  return (
    <div className={`el-counter ${alignClass(p.align ?? 'center')}`}>
      <div className="el-counter__number">
        {figure ?? (
          <>
            {str(p.prefix) && <span>{str(p.prefix)}</span>}
            {shown}
            {str(p.suffix) && <span>{str(p.suffix)}</span>}
          </>
        )}
      </div>
      {str(p.title) && <div className="el-counter__title">{str(p.title)}</div>}
    </div>
  )
}

/** `progress-bar`: a labelled Shine `progress` bar (a native progress element). Shape "ring" draws the circle progress instead. */
export const ProgressBarElement: React.FC<P> = (p) => {
  if (pick(p.shape, ['bar', 'ring'] as const, 'bar') === 'ring') return <CircleProgressElement percent={p.percent} label={str(p.title)} />
  const pct = num(p.percent, 70, 0, 100)
  const title = str(p.title, 'Progress')
  return (
    <div className="el-progress">
      <div className="el-progress__head">
        <span>{title}</span>
        {flag(p.showPercent, true) && <span>{Math.round(pct)}%</span>}
      </div>
      <progress className="progress" max={100} value={Math.round(pct)} aria-label={title} />
    </div>
  )
}

const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'
const Stars: React.FC<{ count: number; filled?: boolean }> = ({ count, filled }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <svg key={i} width="1em" height="1em" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d={STAR} />
      </svg>
    ))}
  </>
)

/** Exported so testimonials can show the same stars. */
export const StarsRow: React.FC<{ rating: number; max?: number; label?: string }> = ({ rating, max = 5, label }) => {
  const m = Math.round(Math.min(Math.max(max, 1), 10))
  const r = Math.min(Math.max(rating, 0), m)
  return (
    <span className="el-stars" role="img" aria-label={label || `${r} out of ${m} stars`}>
      <span className="el-stars__base">
        <Stars count={m} />
      </span>
      <span className="el-stars__fill" style={{ width: `${(r / m) * 100}%` }}>
        <Stars count={m} filled />
      </span>
    </span>
  )
}

/** `star-rating`: 0 to `scale` stars, halves allowed. */
export const StarRatingElement: React.FC<P> = (p) => {
  const max = Math.round(num(p.scale, 5, 1, 10))
  const rating = num(p.rating, 4.5, 0, max)
  return (
    <div className={`el-rating ${alignClass(p.align)}`}>
      <StarsRow rating={rating} max={max} />
      {str(p.title) && <span className="el-rating__title">{str(p.title)}</span>}
    </div>
  )
}

const ALERT_KINDS = ['info', 'success', 'warning', 'danger'] as const

/** `alert`: a coloured notice box. Placement "fixed-top" or "fixed-bottom" gives the full-width sticky bar instead. */
export const AlertElement: React.FC<P> = (p) => {
  const kind = pick(p.kind, ALERT_KINDS, 'info')
  const placement = pick(p.placement, ['inline', 'fixed-top', 'fixed-bottom'] as const, 'inline')
  if (placement !== 'inline') return <AlertFixed p={p} kind={kind} edge={placement === 'fixed-bottom' ? 'bottom' : 'top'} />
  const button = str(p.buttonText).trim()
  const href = linkHref(p.buttonUrl)
  const role = kind === 'danger' ? 'alert' : 'note'
  const body = (
    <>
      {str(p.title) && <strong className="el-alert__title">{str(p.title)}</strong>}
      {str(p.text) && <p>{str(p.text)}</p>}
      {button && href && (
        <p className="el-alert__actions">
          <a className="el-alert__btn" href={href} {...linkAttrs(p.buttonUrl)}>
            {button}
          </a>
        </p>
      )}
    </>
  )
  const toast = flag(p.toast)
  if (flag(p.dismissible) || toast) {
    return (
      <AlertDismiss className={`el-alert el-alert--${kind}`} role={role} toast={toast} autoCloseSeconds={toast && num(p.autoClose, 0, 0, 120) > 0 ? num(p.autoClose, 0, 0, 120) : undefined}>
        {body}
      </AlertDismiss>
    )
  }
  return (
    <div className={`el-alert el-alert--${kind}`} role={role}>
      {body}
    </div>
  )
}

/** Colours for the fixed bar, per alert type. Text colour is picked so the contrast holds on each background. */
const FIXED_COLOURS: Record<(typeof ALERT_KINDS)[number], { bg: string; fg: string }> = {
  info: { bg: '#2e3192', fg: '#ffffff' },
  success: { bg: '#1e7e4a', fg: '#ffffff' },
  warning: { bg: '#f5a623', fg: '#1f2230' },
  danger: { bg: '#b03a2e', fg: '#ffffff' },
}

/** A fixed alert is the sticky-bar look (Wave37Elements): full width, pinned to an edge, no close button. */
const AlertFixed: React.FC<{ p: P; kind: (typeof ALERT_KINDS)[number]; edge: 'top' | 'bottom' }> = ({ p, kind, edge }) => {
  const title = str(p.title).trim()
  const text = str(p.text).trim()
  const message = title && text ? `${title}: ${text}` : title || text
  const c = FIXED_COLOURS[kind]
  // The bar's button is only drawn when the link is safe, so a refused address leaves no dead button.
  const hasLink = Boolean(linkHref(p.buttonUrl))
  return (
    <StickyBarElement
      text={message}
      mode="fixed"
      position={edge}
      background={c.bg}
      textColor={c.fg}
      buttonLabel={hasLink ? str(p.buttonText).trim() : ''}
      link={p.buttonUrl}
    />
  )
}

/** Share-mode network keys (Wave36 ShareButtons) for the social-icons network names. Other networks have no share link. */
const SHARE_KEY: Record<string, string> = { facebook: 'facebook', x: 'x', twitter: 'x', linkedin: 'linkedin', email: 'email' }

/** `social-icons` in share mode: the ShareButtons look for the networks listed, sharing the page address in "pageUrl". */
const SocialShare: React.FC<{ p: P }> = ({ p }) => {
  const flags: P = {}
  for (const [network = ''] of cells(p.items, 2)) {
    const key = SHARE_KEY[network.toLowerCase()]
    if (key) flags[key] = true
  }
  const shareProps: P = { ...flags, title: str(p.title), shareUrl: str(p.pageUrl), style: 'icons', align: pick(p.align, ['left', 'center', 'right'] as const, 'left') }
  return str(p.pageUrl) ? <ShareButtonsElement {...shareProps} /> : <ShareWithPageUrl {...shareProps} />
}

/** `social-icons`: one line per link as "network | url". Mode "share" turns it into share links for the page. */
export const SocialIconsElement: React.FC<P> = (p) => {
  if (pick(p.mode, ['follow', 'share'] as const, 'follow') === 'share') return <SocialShare p={p} />
  const rows = cells(p.items, 2)
  const shape = pick(p.shape, ['circle', 'square', 'plain'] as const, 'circle')
  const size = num(p.size, 20, 12, 48)
  return (
    <ul className={`el-social el-social--${shape} ${alignClass(p.align)}`}>
      {rows.map(([network, url], i) => {
        const key = network.toLowerCase()
        const href = safeUrl(key === 'email' && url && !/^mailto:/i.test(url) && !url.includes(':') ? `mailto:${url}` : url)
        if (!href) return null
        return (
          <li key={i}>
            <a href={href} aria-label={network} rel="noopener noreferrer" target={href.startsWith('http') ? '_blank' : undefined}>
              <SocialGlyph network={key} size={size} />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
