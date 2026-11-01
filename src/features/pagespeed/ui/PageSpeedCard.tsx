'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { CollapsibleCard } from '@/admin/components/CollapsibleCard'
import { useCardOpen } from '@/admin/components/collapseStore'

import {
  THRESHOLDS,
  formatBytes,
  formatMetric,
  scoreBand,
  scoreDelta,
  type Band,
  type MetricKey,
  type Scores,
  type StoredResult,
  type Strategy,
} from '../types'
import { AdminLineChart } from '@/admin/charts/AdminLineChart'
import './pagespeed.css'
import { Tooltip } from '@/components/admin/shared/Tooltip'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'

type Loaded = {
  testable: boolean
  reason: string | null
  url: string | null
  hasKey: boolean
  canRun: boolean
  results: Record<Strategy, StoredResult[]>
}

const CARD_ID = 'pagespeed'

const RINGS: { key: keyof Scores; label: string; help: string }[] = [
  { key: 'performance', label: 'Performance', help: 'How fast the page loads and becomes usable. 90 or more is good, 50 to 89 needs work, under 50 is poor. Scores vary a few points from run to run.' },
  { key: 'accessibility', label: 'Accessibility', help: 'How usable the page is for people with disabilities: contrast, labels, alt text. Automated checks only catch part of the problems.' },
  { key: 'bestPractices', label: 'Best practices', help: 'Security and modern web standards: https, no console errors, safe libraries.' },
  { key: 'seo', label: 'SEO', help: 'Basic search engine checks: title, description, crawlable links. It does not measure ranking.' },
]

const bandClass = (band: Band | null): string => `ps-band--${band ?? 'none'}`

const BAND_WORD: Record<Band, string> = { good: 'Good', 'needs-work': 'Needs work', poor: 'Poor' }

function Ring({ label, help, score, previous }: { label: string; help: string; score: number | null; previous: number | null }) {
  const t = useAdminT()
  const band = scoreBand(score)
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const delta = scoreDelta(score, previous)
  return (
    <Tooltip text={help}><div className={`ps-ring ${bandClass(band)}`}>
      <svg className="ps-ring__svg" viewBox="0 0 72 72" role="img" aria-label={`${label}: ${score === null ? 'no score' : `${score} out of 100${band ? `, ${BAND_WORD[band]}` : ''}`}`}>
        <circle className="ps-ring__track" cx="36" cy="36" r={radius} />
        {score !== null && (
          <circle className="ps-ring__value" cx="36" cy="36" r={radius} strokeDasharray={`${(score / 100) * circumference} ${circumference}`} />
        )}
        <text className="ps-ring__text" x="36" y="37">
          {score === null ? '-' : score}
        </text>
      </svg>
      <span className="ps-ring__label">{label}</span>
      {delta && (
        <Tooltip text={t('tip.changeSinceThePreviousTest')}><span className={`ps-delta ps-delta--${delta.direction}`}>
          {delta.direction === 'same' ? 'no change' : `${delta.change > 0 ? '+' : ''}${delta.change} since last`}
        </span></Tooltip>
      )}
    </div></Tooltip>
  )
}

const METRIC_ORDER: MetricKey[] = ['lcp', 'cls', 'tbt', 'fcp', 'speedIndex', 'ttfb']

function Chart({ history }: { history: StoredResult[] }) {
  const points = [...history].reverse().filter((r) => r.scores.performance !== null)
  if (points.length < 2) return <p className="ps__muted ps__help">Run the test a few times on different days to see a trend here.</p>
  return (
    <AdminLineChart
      points={points.map((p, i) => {
        const score = p.scores.performance as number
        return {
          key: String(p.id ?? i),
          value: score,
          label: new Date(p.fetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          tip: `${score} on ${new Date(p.fetchedAt).toLocaleString()}`,
          className: `ps-chart__dot ${bandClass(scoreBand(score))}`,
        }
      })}
      ariaLabel={`Performance score over the last ${points.length} tests`}
      axisMin={0}
      axisMax={100}
      ticks={[0, 50, 90, 100]}
      formatTick={(tick) => String(tick)}
      emptyText=""
      width={300}
      height={110}
    />
  )
}

function Report({ latest, previous, hasKey }: { latest: StoredResult; previous: StoredResult | null; hasKey: boolean }) {
  const t = useAdminT()
  const metrics = METRIC_ORDER.filter((key) => latest.metrics[key])
  const field = latest.fieldData
  const fieldKeys = field ? (['lcp', 'cls', 'inp', 'fcp', 'ttfb'] as const).filter((key) => field.metrics[key]) : []
  return (
    <>
      <div className="ps__rings">
        {RINGS.map((ring) => (
          <Ring key={ring.key} label={ring.label} help={ring.help} score={latest.scores[ring.key]} previous={previous ? previous.scores[ring.key] : null} />
        ))}
      </div>
      <p className="ps__muted ps__help">
        Tested {new Date(latest.fetchedAt).toLocaleString()}
        {latest.source === 'auto' ? ' (automatic test after publishing)' : ''}
        {previous ? `, compared with the test on ${new Date(previous.fetchedAt).toLocaleDateString()}` : ''}. Scores shift a few points between runs, so look at the trend rather than one number.
        {!hasKey ? ' No Google API key is set, so tests share a small free allowance (Integrations > Google).' : ''}
      </p>

      {metrics.length > 0 && (
        <div>
          <h3 className="ps__h">Core Web Vitals and speed (lab test)</h3>
          <table className="ps__table">
            <tbody>
              {metrics.map((key) => {
                const metric = latest.metrics[key]
                if (!metric) return null
                const prev = previous?.metrics[key]
                return (
                  <tr key={key} className={bandClass(metric.band)}>
                    <th scope="row">
                      <span className="ps-dot" aria-hidden="true" />
                      <Tooltip text={THRESHOLDS[key].help}><span className="ps__tip">{THRESHOLDS[key].label}</span></Tooltip>
                    </th>
                    <td>
                      <span className="ps__value">{formatMetric(key, metric.value)}</span> <span className="ps__muted">{BAND_WORD[metric.band]}</span>
                      {prev && prev.value !== metric.value ? (
                        <span className="ps__muted"> (was {formatMetric(key, prev.value)})</span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {field && fieldKeys.length > 0 && (
        <div>
          <h3 className="ps__h"><Tooltip text={t('tip.measuredFromRealChromeVisitors')}><span>
            Real visitors (Chrome UX Report){field.originFallback ? ', whole site' : ''}
          </span></Tooltip></h3>
          <table className="ps__table">
            <tbody>
              {fieldKeys.map((key) => {
                const metric = field.metrics[key]
                if (!metric) return null
                return (
                  <tr key={key} className={bandClass(metric.band)}>
                    <th scope="row">
                      <span className="ps-dot" aria-hidden="true" />
                      <Tooltip text={THRESHOLDS[key].help}><span className="ps__tip">{THRESHOLDS[key].label}</span></Tooltip>
                    </th>
                    <td>
                      <span className="ps__value">{formatMetric(key, metric.percentile)}</span> <span className="ps__muted">{BAND_WORD[metric.band]}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {field.originFallback && <p className="ps__muted ps__help">This page has too little traffic for its own figures, so these describe the whole site.</p>}
        </div>
      )}

      {latest.suggestions.opportunities.length > 0 && (
        <div>
          <h3 className="ps__h"><Tooltip text={t('tip.changesGoogleEstimatesWouldMake')}><span>Opportunities</span></Tooltip></h3>
          <ul className="ps__list">
            {latest.suggestions.opportunities.map((item) => (
              <li key={item.id}>
                <span>{item.title}</span>
                <span className="ps__saving">
                  {item.savingsMs ? `${formatMetric('fcp', item.savingsMs)}` : ''}
                  {item.savingsMs && item.savingsBytes ? ', ' : ''}
                  {item.savingsBytes ? formatBytes(item.savingsBytes) : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {latest.suggestions.diagnostics.length > 0 && (
        <div>
          <h3 className="ps__h"><Tooltip text={t('tip.thingsWorthLookingAtThat')}><span>Diagnostics</span></Tooltip></h3>
          <ul className="ps__list">
            {latest.suggestions.diagnostics.map((item) => (
              <li key={item.id}>
                <span>{item.title}</span>
                {item.displayValue ? <span className="ps__saving">{item.displayValue}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function PageSpeedBody({ collectionSlug, id }: { collectionSlug: string; id: number }) {
  const t = useAdminT()
  const [open] = useCardOpen(CARD_ID)
  const [data, setData] = useState<Loaded | null>(null)
  const [strategy, setStrategy] = useState<Strategy>('mobile')
  const [busy, setBusy] = useState<Strategy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requested = useRef(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin-pagespeed?collection=${encodeURIComponent(collectionSlug)}&id=${id}`)
      const json = (await response.json().catch((): null => null)) as (Loaded & { error?: string }) | null
      if (!response.ok || !json) throw new Error(json?.error || 'Could not load PageSpeed results.')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load PageSpeed results.')
    }
  }, [collectionSlug, id])

  // Load once, the first time the card is opened.
  useEffect(() => {
    if (!open || requested.current) return
    requested.current = true
    void load()
  }, [open, load])

  const run = async (which: Strategy) => {
    setBusy(which)
    setError(null)
    setStrategy(which)
    try {
      const response = await fetch('/api/admin-pagespeed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: collectionSlug, id, strategy: which }),
      })
      const json = (await response.json().catch((): null => null)) as { error?: string } | null
      if (!response.ok) throw new Error(json?.error || 'The test failed.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The test failed.')
    } finally {
      setBusy(null)
    }
  }

  const history = data?.results[strategy] ?? []
  const latest = history[0]
  const previous = history[1] ?? null

  return (
    <div className="ps">
      {!data && !error && <p className="ps__muted">Loading...</p>}
      {data && !data.testable && <p className="ps__muted">{data.reason}</p>}
      {data && (
        <div className="ps__bar">
          <div className="ps__tabs" role="group" aria-label="Device">
            {(['mobile', 'desktop'] as const).map((which) => (
              <button key={which} type="button" className="ps__tab" aria-pressed={strategy === which} onClick={() => setStrategy(which)}>
                {which === 'mobile' ? 'Mobile' : 'Desktop'}
              </button>
            ))}
          </div>
          {data.canRun && (
            <Tooltip text={t('tip.asksGoogleToLoadThe')}><button
              type="button"
              className="btn"
              disabled={busy !== null || !data.testable}
              onClick={() => void run(strategy)}
            >
              {busy ? `Testing ${busy}...` : `Run ${strategy} test`}
            </button></Tooltip>
          )}
          {data.url && <span className="ps__muted">{data.url}</span>}
        </div>
      )}
      {error && <p className="ps__error" role="alert">{error}</p>}
      {data && latest && <Report latest={latest} previous={previous} hasKey={data.hasKey} />}
      {data && !latest && data.testable && <p className="ps__muted">No {strategy} test yet. Run one to see scores, Core Web Vitals and suggestions.</p>}
      {history.length > 0 && (
        <div>
          <h3 className="ps__h"><Tooltip text={t('tip.performanceScoreOfEachPast')}><span>History ({strategy})</span></Tooltip></h3>
          <Chart history={history} />
        </div>
      )}
    </div>
  )
}

/**
 * Collapsed card on the edit screen of pages, posts, products and events: run a Google PageSpeed test
 * on the live page and read the scores, Core Web Vitals, suggestions and history.
 */
export function PageSpeedCard({ collectionSlug, id }: { collectionSlug: string; id?: number }) {
  if (id === undefined) return null
  return (
    <CollapsibleCard id={CARD_ID} title="PageSpeed" className="doc-pagespeed-card">
      <PageSpeedBody collectionSlug={collectionSlug} id={id} />
    </CollapsibleCard>
  )
}

export default PageSpeedCard
