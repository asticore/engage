import React from 'react'

import { EMBED_NAME, EMBED_PROVIDERS, embedLayout, resolveEmbed, type EmbedProvider } from '@/lib/embedProviders'
import { safeUrl } from '@/lib/mergeTags'

import { flag, mediaOf, num, pick, str, type MediaRef } from './elementUtil'
import { legacyRowsToCsv, parseCsv, sparkAttrs } from './sparkData'
import { EmbedConsentFrame } from './EmbedConsentFrame'
import './wave48.css'

/**
 * Wave 48 renderers (src/lib/elements/wave48Defs.ts): chart, embed, reviews and pagination. Server-safe, no client JS.
 * Charts are inline SVG with a visually hidden table of the same data. Motion is CSS only and sits inside a
 * prefers-reduced-motion: no-preference guard (wave48.css).
 */

type P = Record<string, unknown>

const ELLIPSIS = String.fromCodePoint(0x2026)
/* ---------- chart ---------- */

/** Charts whose data prop is CSV; Spark reads it from `data-spark-csv` (or labels and series for the ones without). */
const CSV_CHARTS = new Set(['chart-bar', 'chart-line', 'chart-heatmap', 'chart-polar', 'chart-progress', 'chart-treemap'])
/** Charts that take category labels plus one or more series of numbers. */
const SERIES_CHARTS = new Set(['chart-combo', 'chart-radar', 'chart-pie', 'chart-funnel', 'chart-waterfall'])
const CHART_ID_RE = /^(chart|diagram|viz)-[a-z]+$/
const MAX_ROWS = 500

/** The effect id a stored chartType means: "bar" from the first version becomes "chart-bar". */
function chartId(v: unknown): string {
  const raw = str(v).trim()
  if (CHART_ID_RE.test(raw)) return raw
  return /^[a-z]+$/.test(raw) ? `chart-${raw}` : 'chart-bar'
}

const SUMMARY_ROWS = 12

/**
 * Text summary of a tabular chart for screen readers, read as the name of the role=img wrapper. Names the chart kind,
 * the series and (for stacked or horizontal charts) the layout, then up to 12 rows as "label: series value, ...".
 * Longer data is left to the table that follows the chart. `table` is the parsed CSV (header row first).
 */
export function chartSummary(table: string[][], kind: string, options: { title?: string; stacked?: boolean; horizontal?: boolean } = {}): string {
  const head = table[0] ?? []
  const names = head.slice(1).map((n, i) => n.trim() || `Series ${i + 1}`)
  const body = table.slice(1)
  const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1)
  const parts = [`${kindLabel} chart${options.title ? `: ${options.title}` : ''}.`]
  if (names.length) parts.push(`${names.length === 1 ? '1 series' : `${names.length} series`}: ${names.join(', ')}.`)
  if (options.stacked) parts.push('Stacked.')
  if (options.horizontal) parts.push('Horizontal.')
  if (body.length) {
    const rows = body.slice(0, SUMMARY_ROWS).map((r) => `${r[0] || 'Item'}: ${names.map((n, i) => `${n} ${r[i + 1] ?? ''}`.trim()).join(', ')}`)
    parts.push(`${rows.join('; ')}.`)
    if (body.length > SUMMARY_ROWS) parts.push(`${body.length - SUMMARY_ROWS} more rows are in the table.`)
  }
  return parts.join(' ')
}

function seriesAttrs(table: string[][]): Record<string, string> {
  const head = table[0] ?? []
  const body = table.slice(1)
  const series = head.slice(1).map((_, c) => body.map((r) => String(Number((r[c + 1] ?? '').replace(/[,\s]/g, '')) || 0)).join(','))
  return { 'data-spark-labels': body.map((r) => r[0] ?? '').join('|'), 'data-spark-data': series.join('|'), 'data-spark-names': head.slice(1).join('|') }
}

/**
 * `chart`: any Spark chart, diagram or visualisation (asticore/spark). Renders the Spark class and `data-spark-*`
 * attributes; the Spark loader draws the chart in the browser, in the Shine colours of the theme unless colours are set.
 * The same data is also in a visually hidden table for screen readers and for visitors without scripts.
 */
export const ChartElement: React.FC<P> = (p) => {
  const id = chartId(p.chartType)
  const title = str(p.title).trim()
  const tabular = CSV_CHARTS.has(id) || SERIES_CHARTS.has(id)
  const csv = tabular ? legacyRowsToCsv(p.data) : ''
  const table = csv ? parseCsv(csv).slice(0, MAX_ROWS) : []
  const raw = tabular ? '' : str(p[`d_${id}`]).trim() || (typeof p.data === 'string' && !/^[\w\s]+\|/.test(p.data) ? p.data.trim() : '')
  if (tabular && table.length < 2) return null
  if (!tabular && !raw && !['chart-gauge', 'diagram-fishbone', 'diagram-tree', 'diagram-flow', 'diagram-cycle'].includes(id)) return null

  const attrs: Record<string, string> = sparkAttrs(p, `o_${id}_`)
  if (tabular) Object.assign(attrs, CSV_CHARTS.has(id) ? { 'data-spark-csv': csv } : seriesAttrs(table))
  else if (raw) attrs['data-spark-data'] = raw
  if (title) attrs['data-spark-title'] = title
  // Tabular charts name themselves with a text summary; the visually hidden table below stays the full data.
  const summary =
    tabular && table.length > 1
      ? chartSummary(table, id.replace(/^chart-/, '').replace(/-/g, ' '), { title, stacked: flag(p[`o_${id}_stacked`], false), horizontal: flag(p[`o_${id}_horizontal`], false) })
      : ''

  return (
    <figure className="be-el-48-chart">
      {title && <figcaption className="be-el-48-chart__title">{title}</figcaption>}
      <div className={`spark-${id}`} {...attrs} role={summary ? 'img' : undefined} aria-label={summary || undefined} />
      {table.length > 1 && (
        <table className="be-el-48-sr">
          <caption>{title || 'Chart data'}</caption>
          <thead>
            <tr>
              {table[0]!.map((c, i) => (
                <th key={i} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.slice(1).map((r, i) => (
              <tr key={i}>
                {table[0]!.map((_, j) =>
                  j === 0 ? (
                    <th key={j} scope="row">
                      {r[j] ?? ''}
                    </th>
                  ) : (
                    <td key={j}>{r[j] ?? ''}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  )
}

/* ---------- embed ---------- */

export type { EmbedProvider }
export { resolveEmbed }
const RATIO_CSS: Record<string, string> = { '16:9': '16 / 9', '4:3': '4 / 3', '1:1': '1 / 1' }
const SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms'

/**
 * `embed`: an iframe from a fixed host allowlist (lazy, sandboxed, with a referrer policy), or a link card for
 * Pinterest boards and LottieFiles pages. Anything else gets a plain message instead of an embed.
 */
export const EmbedElement: React.FC<P> = (p) => {
  const provider = pick(p.provider, EMBED_PROVIDERS, 'youtube')
  const target = resolveEmbed(provider, str(p.url))
  if (!target) return null
  if (target.kind === 'error') return <p className="be-el-48-embed__message">{target.message}</p>
  const name = EMBED_NAME[provider]
  const title = str(p.title).trim() || name
  if (target.kind === 'link') {
    return (
      <div className="be-el-48-embed be-el-48-embed--card">
        <a className="be-el-48-embed__card" href={target.href} target="_blank" rel="noopener noreferrer">
          <span className="be-el-48-embed__provider">{name}</span>
          <span className="be-el-48-embed__title">{title}</span>
          <span className="be-el-48-embed__cta">{`Open on ${name}`}</span>
        </a>
      </div>
    )
  }
  const ratio = pick(p.ratio, ['16:9', '4:3', '1:1'] as const, '16:9')
  // The iframe is only created after the visitor accepts marketing cookies (see EmbedConsentFrame).
  return (
    <EmbedConsentFrame
      src={target.src}
      title={title}
      providerName={name}
      aspectRatio={RATIO_CSS[ratio]}
      {...embedLayout(provider, target.src)}
      sandbox={SANDBOX}
      allow="encrypted-media; picture-in-picture; clipboard-write"
    />
  )
}

/* ---------- reviews ---------- */

type Review = { name: string; rating: number | null; text: string; source: string; avatar: MediaRef | null }
type RatedReview = Review & { rating: number }

const REVIEW_LIMIT = 24
const STAR = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'

/** Repeater rows as reviews. A rating is 1 to 5 (rounded); a row with none is shown without stars and left out of the average. */
function reviewsOf(v: unknown): Review[] {
  if (!Array.isArray(v)) return []
  const out: Review[] = []
  for (const row of v) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const raw = num(r.rating, NaN)
    const rating = Number.isNaN(raw) || raw < 1 ? null : Math.min(5, Math.round(raw))
    const name = str(r.name).trim()
    const body = str(r.text).trim()
    if (!name && !body && rating === null) continue
    out.push({ name, rating, text: body, source: str(r.source).trim(), avatar: mediaOf(r.avatar) })
    if (out.length === REVIEW_LIMIT) break
  }
  return out
}

/** Stars as one SVG with an accessible name such as "4 out of 5". Filled stars come from the wave48 CSS. */
const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <svg className="be-el-48-stars" viewBox="0 0 120 24" width="120" height="24" role="img" aria-label={`${rating} out of 5`}>
    {[0, 1, 2, 3, 4].map((i) => (
      <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} className={i < rating ? 'be-el-48-stars__on' : 'be-el-48-stars__off'} />
    ))}
  </svg>
)

/**
 * schema.org Product with an AggregateRating and one Review per rated review. "<" is escaped so no review text can
 * end the script element early. The escape is built at run time so this source file holds no escape sequence.
 */
function reviewJsonLd(name: string, rated: RatedReview[], average: number): string {
  const doc = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(average.toFixed(1)), reviewCount: rated.length, bestRating: 5, worstRating: 1 },
    review: rated.map((r) => ({
      '@type': 'Review',
      ...(r.name ? { author: { '@type': 'Person', name: r.name } } : {}),
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      ...(r.text ? { reviewBody: r.text } : {}),
    })),
  }
  return JSON.stringify(doc).split('<').join(String.fromCharCode(92) + 'u003c')
}

/**
 * `reviews`: rated reviews in a grid or a list. Stars are optional. The average is computed from the rated reviews, and
 * Review JSON-LD is added only when the option is on and the item has a name.
 */
export const ReviewsElement: React.FC<P> = (p) => {
  const reviews = reviewsOf(p.items)
  if (reviews.length === 0) return null
  const layout = pick(p.layout, ['grid', 'list'] as const, 'grid')
  const showStars = flag(p.showStars, true)
  const rated = reviews.filter((r): r is RatedReview => r.rating !== null)
  const average = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : null
  const itemName = str(p.itemName).trim()

  return (
    <div className={`be-el-48-reviews be-el-48-reviews--${layout}`}>
      {average !== null && (
        <p className="be-el-48-reviews__summary">
          Average {average.toFixed(1)} out of 5 from {rated.length} {rated.length === 1 ? 'review' : 'reviews'}
        </p>
      )}
      <ul className="be-el-48-reviews__list">
        {reviews.map((r, i) => (
          <li key={i}>
            <article className="be-el-48-review">
              {showStars && r.rating !== null && <Stars rating={r.rating} />}
              {r.text && <p className="be-el-48-review__text">{r.text}</p>}
              <footer className="be-el-48-review__by">
                {r.avatar?.url && <img decoding="async" className="be-el-48-review__avatar" src={r.avatar.url} alt="" width={40} height={40} loading="lazy" />}
                <span>
                  {r.name && <strong className="be-el-48-review__name">{r.name}</strong>}
                  {r.name && r.source && ' '}
                  {r.source && <span className="be-el-48-review__source">{r.source}</span>}
                </span>
              </footer>
            </article>
          </li>
        ))}
      </ul>
      {flag(p.jsonLd, false) && itemName && average !== null && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: reviewJsonLd(itemName, rated, average) }} />
      )}
    </div>
  )
}

/* ---------- pagination ---------- */

const PAGE_TOKEN = '{page}'
const DEFAULT_PATTERN = '?page={page}'
const PAGINATION_ALIGN = ['left', 'centre', 'right'] as const

/**
 * Link for one page: the pattern with the token swapped for the integer. Only a safe result gives a link. A query
 * string on its own is allowed because safeUrl only takes absolute or root-relative addresses.
 */
function pageHref(pattern: string, n: number): string | null {
  const href = pattern.split(PAGE_TOKEN).join(String(n))
  if (href.startsWith('?')) return /^\?[^\s"'<>]*$/.test(href) ? href : null
  return safeUrl(href)
}

/**
 * Pages to show, with 'gap' where pages are left out. Keeps the first and last page and the pages near the current
 * one, and never shows more than `max` items. Each gap hides at least two pages.
 */
function pageItems(current: number, total: number, max: number): Array<number | 'gap'> {
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1)
  const side = Math.floor((max - 5) / 2)
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  if (current - side <= 3) return [...range(1, max - 2), 'gap', total]
  if (current + side >= total - 2) return [1, 'gap', ...range(total - max + 3, total)]
  return [1, 'gap', ...range(current - side, current + side), 'gap', total]
}

/**
 * `pagination`: previous and next links with numbered pages, in a navigation landmark. The current page has
 * aria-current. Links come only from the pattern with an integer page number, and nothing renders for one page.
 */
export const PaginationElement: React.FC<P> = (p) => {
  const total = Math.floor(num(p.total, 1, 1, 10000))
  if (total <= 1) return null
  const current = Math.floor(num(p.current, 1, 1, total))
  const max = Math.floor(num(p.maxLinks, 7, 5, 11))
  const raw = str(p.baseUrl).trim()
  const pattern = raw.includes(PAGE_TOKEN) ? raw : DEFAULT_PATTERN
  const align = pick(p.align, PAGINATION_ALIGN, 'centre')
  const prevLabel = str(p.prevLabel).trim() || 'Previous'
  const nextLabel = str(p.nextLabel).trim() || 'Next'
  const hasPrev = current > 1
  const hasNext = current < total

  /** A link when there is a safe href, otherwise plain text so no unsafe address is ever written. */
  const item = (href: string | null, text: React.ReactNode, className: string, extra: Record<string, string> = {}) =>
    href ? (
      <a className={className} href={href} {...extra}>
        {text}
      </a>
    ) : (
      <span className={className} {...extra}>
        {text}
      </span>
    )
  const base = 'be-el-48-pagination__item'

  return (
    <nav className={`be-el-48-pagination be-el-48-pagination--${align}`} aria-label="Pagination">
      <ul className="pagination be-el-48-pagination__list">
        <li>
          {hasPrev
            ? item(pageHref(pattern, current - 1), prevLabel, base, { rel: 'prev' })
            : item(null, prevLabel, `${base} ${base}--disabled`, { 'aria-disabled': 'true' })}
        </li>
        {pageItems(current, total, max).map((it, i) => (
          <li key={i}>
            {it === 'gap' ? (
              <span className="be-el-48-pagination__gap" aria-hidden="true">
                {ELLIPSIS}
              </span>
            ) : it === current ? (
              <span className={`${base} ${base}--current`} aria-current="page">
                {it}
              </span>
            ) : (
              item(pageHref(pattern, it), it, base, { 'aria-label': `Page ${it}` })
            )}
          </li>
        ))}
        <li>
          {hasNext
            ? item(pageHref(pattern, current + 1), nextLabel, base, { rel: 'next' })
            : item(null, nextLabel, `${base} ${base}--disabled`, { 'aria-disabled': 'true' })}
        </li>
      </ul>
    </nav>
  )
}

/** Components for the wave-48 elements, keyed by elementType. Spread into ELEMENT_COMPONENTS. */
export const WAVE48_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  chart: ChartElement,
  embed: EmbedElement,
  reviews: ReviewsElement,
  pagination: PaginationElement,
}
