'use client'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import type { UiStringKey } from '@/features/uiStrings'
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CollapsibleCard } from '@/admin/components/CollapsibleCard'
import type { Status } from '@/features/seo/analysis/types'
import { AUDIT_COLLECTIONS, type AuditCollection, type AuditRow, type AuditSummary } from '@/features/seo/audit'
import { DEFAULT_AUDIT_FILTERS, filterAuditRows, sortAuditRows, type AuditFilters, type ScoreFilter, type SortKey } from '@/features/seo/auditFilters'
import { changedSeoRows, rowKey, type SeoEditField, type SeoEditMap } from '@/features/seo/auditEdits'
import './seo-audit.css'
import { Tooltip } from '@/components/admin/shared/Tooltip'

type AuditResponse = { rows: AuditRow[]; summary: AuditSummary }
type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: AuditResponse }

const COLLECTION_LABEL: Record<AuditCollection, string> = { pages: 'Pages', posts: 'Blog', products: 'Products', events: 'Events' }
const TYPE_LABEL: Record<AuditCollection, string> = { pages: 'Page', posts: 'Post', products: 'Product', events: 'Event' }
const STATUS_KEY: Record<Status, UiStringKey | null> = { good: 'se.lit.good', ok: 'se.lit.could_be_better', bad: 'se.lit.needs_work', info: null }
const SCORE_OPTIONS: { value: ScoreFilter; labelKey: UiStringKey }[] = [
  { value: 'all', labelKey: 'se.lit.any_score' },
  { value: 'bad', labelKey: 'se.lit.needs_work' },
  { value: 'ok', labelKey: 'se.lit.could_be_better' },
  { value: 'good', labelKey: 'se.lit.good' },
]
const SORT_OPTIONS: { value: SortKey; labelKey: UiStringKey }[] = [
  { value: 'worst', labelKey: 'se.lit.needs_work_first' },
  { value: 'best', labelKey: 'se.lit.good_first' },
  { value: 'title', labelKey: 'se.lit.title_a_to_z' },
]
const PROBLEMS_SHOWN = 3

function StatusDot({ status }: { status: Status }) {
  const t = useAdminT()
  const text = STATUS_KEY[status] ? t(STATUS_KEY[status]) : 'For information'
  return <Tooltip text={text}><span className={`sa-dot sa-dot--${status}`} role="img" aria-label={text} /></Tooltip>
}

function SummaryTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="sa-tile">
      <div className="sa-tile__value">{value}</div>
      <div className="sa-tile__label">{label}</div>
    </div>
  )
}

function SummaryCards({ summary }: { summary: AuditSummary }) {
  const t = useAdminT()
  return (
    <div className="sa-tiles">
      <SummaryTile value={summary.total} label={t('se.lit.items_checked')} />
      <SummaryTile value={summary.good} label={t('se.lit.good')} />
      <SummaryTile value={summary.ok} label={t('se.lit.could_be_better')} />
      <SummaryTile value={summary.bad} label={t('se.lit.needs_work')} />
      <SummaryTile value={summary.missingKeyphrase} label={t('se.lit.no_focus_keyphrase')} />
      <SummaryTile value={summary.missingMetaDescription} label={t('se.lit.no_meta_description')} />
      <SummaryTile value={summary.noIndex} label={t('se.lit.hidden_from_search_engines')} />
      <SummaryTile value={summary.cornerstone} label="Cornerstone" />
      <SummaryTile value={summary.orphans} label="Pages with no links to them" />
    </div>
  )
}

function ProblemList({ problems }: { problems: string[] }) {
  const t = useAdminT()
  if (problems.length === 0) return <span className="sa-muted">{t('se.lit.none')}</span>
  const shown = problems.slice(0, PROBLEMS_SHOWN)
  const extra = problems.length - shown.length
  return (
    <ul className="sa-problems">
      {shown.map((problem) => (
        <li key={problem}>{problem}</li>
      ))}
      {extra > 0 && <li className="sa-muted">and {extra} more</li>}
    </ul>
  )
}

/** The value shown in an editable cell: the pending edit when there is one, else the saved value. */
function cellValue(row: AuditRow, edits: EditMap, field: EditField): string {
  return edits[rowKey(row)]?.[field] ?? row[field === 'metaTitle' ? 'metaTitle' : 'metaDescription']
}

function AuditTable({ rows, edits, errors, onEdit }: { rows: AuditRow[]; edits: EditMap; errors: ErrorMap; onEdit: (row: AuditRow, field: EditField, value: string) => void }) {
  const t = useAdminT()
  const router = useRouter()
  return (
    <div className="sa-table-wrap">
      <table className="sa-table">
        <thead>
          <tr>
            <th scope="col">{t('se.lit.score')}</th>
            <th scope="col">{t('se.lit.readability')}</th>
            <th scope="col">{t('se.lit.title')}</th>
            <th scope="col">{t('se.lit.type')}</th>
            <th scope="col">{t('se.lit.focus_keyphrase')}</th>
            <th scope="col">SEO title</th>
            <th scope="col">Meta description</th>
            <th scope="col">{t('se.lit.problems')}</th>
            <th scope="col">Links</th>
            <th scope="col">{t('se.lit.search_engines')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row)
            const changed = edits[key] !== undefined
            return (
              <tr
                key={key}
                className="sa-row"
                onClick={(event) => {
                  const target = event.target as HTMLElement
                  if (target.closest('a, input, textarea, select, button, label')) return
                  router.push(row.editHref)
                }}
              >
                <td>
                  <StatusDot status={row.seoScore} />
                </td>
                <td>
                  <StatusDot status={row.readabilityScore} />
                </td>
                <td>
                  <Link href={row.editHref} className="sa-title">
                    {row.title || '(untitled)'}
                  </Link>
                  {row.slug && <div className="sa-slug">/{row.slug}</div>}
                  {row.cornerstone && <div className="sa-slug">Cornerstone</div>}
                </td>
                <td>{TYPE_LABEL[row.collection]}</td>
                <td>{row.hasKeyphrase ? t('se.lit.set') : <span className="sa-missing">{t('se.lit.missing')}</span>}</td>
                <td>
                  <input
                    className={`sa-edit-input${edits[key]?.metaTitle !== undefined ? ' sa-edit-changed' : ''}`}
                    type="text"
                    aria-label={`SEO title for ${row.title || 'untitled'}`}
                    maxLength={300}
                    value={cellValue(row, edits, 'metaTitle')}
                    onChange={(event) => onEdit(row, 'metaTitle', event.target.value)}
                  />
                  {errors[key] && <div className="sa-error-text">{errors[key]}</div>}
                </td>
                <td>
                  <textarea
                    className={`sa-edit-area${edits[key]?.metaDescription !== undefined ? ' sa-edit-changed' : ''}`}
                    aria-label={`Meta description for ${row.title || 'untitled'}`}
                    maxLength={1000}
                    value={cellValue(row, edits, 'metaDescription')}
                    onChange={(event) => onEdit(row, 'metaDescription', event.target.value)}
                  />
                  {changed && <div className="sa-muted">Not saved yet</div>}
                </td>
                <td>
                  <ProblemList problems={row.problems} />
                </td>
                <td>
                  {row.collection === 'pages' ? (
                    <>
                      {row.orphan && <span className="sa-orphan">No links to this page</span>}
                      {row.linkSuggestions.length > 0 ? (
                        <ul className="sa-suggestions" aria-label="Pages to link to">
                          {row.linkSuggestions.map((item) => (
                            <li key={item.href}>
                              {item.title} <span className="sa-slug">{item.href}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        !row.orphan && <span className="sa-muted">None</span>
                      )}
                    </>
                  ) : (
                    <span className="sa-muted">-</span>
                  )}
                </td>
                <td>{row.noIndex ? <span className="sa-missing">{t('se.lit.hidden')}</span> : 'Shown'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FilterControls({ filters, collections, onChange }: { filters: AuditFilters; collections: AuditCollection[]; onChange: (patch: Partial<AuditFilters>) => void }) {
  const t = useAdminT()
  return (
    <div className="sa-filters">
      <label className="sa-field">
        <span className="sa-field__label">{t('se.lit.place')}</span>
        <select value={filters.collection} onChange={(e) => onChange({ collection: e.target.value as AuditFilters['collection'] })}>
          <option value="all">{t('se.lit.all_places')}</option>
          {collections.map((key) => (
            <option key={key} value={key}>
              {COLLECTION_LABEL[key]}
            </option>
          ))}
        </select>
      </label>
      <label className="sa-field">
        <span className="sa-field__label">{t('se.lit.score')}</span>
        <select value={filters.score} onChange={(e) => onChange({ score: e.target.value as ScoreFilter })}>
          {SCORE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>
      <label className="sa-field">
        <span className="sa-field__label">{t('se.lit.problem_contains')}</span>
        <input type="text" value={filters.problemText} placeholder={t('se.lit.for_example_meta_description')} onChange={(e) => onChange({ problemText: e.target.value })} />
      </label>
      <label className="sa-field">
        <span className="sa-field__label">{t('se.lit.sort_by')}</span>
        <select value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as SortKey })}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>
      <label className="sa-check">
        <input type="checkbox" checked={filters.missingKeyphrase} onChange={(e) => onChange({ missingKeyphrase: e.target.checked })} />
        <span>{t('se.lit.missing_focus_keyphrase_only')}</span>
      </label>
      <label className="sa-check">
        <input type="checkbox" checked={filters.cornerstoneOnly} onChange={(e) => onChange({ cornerstoneOnly: e.target.checked })} />
        <span>Cornerstone only</span>
      </label>
      <label className="sa-check">
        <input type="checkbox" checked={filters.orphanOnly} onChange={(e) => onChange({ orphanOnly: e.target.checked })} />
        <span>Pages with no links to them</span>
      </label>
    </div>
  )
}

function useAuditData(): { state: LoadState; reload: () => void } {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin-seo-audit', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Audit request failed: ${res.status}`)
        return (await res.json()) as AuditResponse
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [version])
  return { state, reload: () => setVersion((v) => v + 1) }
}

/** Pending SEO title and description edits, keyed by collection and id (see auditEdits.ts). */
type EditField = SeoEditField
type EditMap = SeoEditMap
type ErrorMap = Record<string, string>

export function SeoAuditClient({ collections }: { collections: AuditCollection[] }) {
  const t = useAdminT()
  const { state, reload } = useAuditData()
  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_AUDIT_FILTERS)
  const onChange = (patch: Partial<AuditFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const [edits, setEdits] = useState<EditMap>({})
  const [errors, setErrors] = useState<ErrorMap>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const onEdit = (row: AuditRow, field: EditField, value: string) => {
    setEdits((current) => ({ ...current, [rowKey(row)]: { ...current[rowKey(row)], [field]: value } }))
    setNotice('')
  }

  const pending = state.status === 'ready' ? changedSeoRows(state.data.rows, edits) : []

  // Saves every changed row in one request. Rows that saved leave the edit list and the audit is read again;
  // rows that failed keep their edits and show the reason.
  const saveEdits = async () => {
    if (state.status !== 'ready' || pending.length === 0) return
    setSaving(true)
    setNotice('')
    try {
      const res = await fetch('/api/admin-seo-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: pending }),
      })
      const body = (await res.json().catch((): null => null)) as { results?: { collection: string; id: number | string; ok: boolean; error?: string }[]; error?: string } | null
      if (!res.ok || !body?.results) {
        setNotice(body?.error || 'The changes could not be saved. Try again.')
        return
      }
      const nextErrors: ErrorMap = {}
      const saved: string[] = []
      for (const result of body.results) {
        const key = `${result.collection}-${result.id}`
        if (result.ok) saved.push(key)
        else nextErrors[key] = result.error || 'Could not save.'
      }
      setErrors(nextErrors)
      setEdits((current) => {
        const copy = { ...current }
        for (const key of saved) delete copy[key]
        return copy
      })
      const failed = body.results.length - saved.length
      setNotice(failed === 0 ? `Saved ${saved.length} ${saved.length === 1 ? 'row' : 'rows'}.` : `Saved ${saved.length}. ${failed} could not be saved (see the notes in the table).`)
      reload()
    } catch {
      setNotice('The changes could not be saved. Check the connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const visible = useMemo(
    () => (state.status === 'ready' ? sortAuditRows(filterAuditRows(state.data.rows, filters), filters.sort) : []),
    [state, filters],
  )

  return (
    <div className="sa-page">
      <header className="sa-header">
        <h1 className="sa-title-main">{t('se.lit.seo_audit')}</h1>
        <p className="sa-intro">
          Checks every published page, post, product and event for search engine and readability problems. Click a row to edit it.
          {AUDIT_COLLECTIONS.length === collections.length ? '' : ' Only the places you can edit or read are shown.'}
        </p>
      </header>

      {state.status === 'loading' && <p className="sa-muted">{t('se.lit.checking_content')}</p>}
      {state.status === 'error' && <p className="sa-alert" role="alert">{t('se.lit.the_audit_could_not_load_refresh_the_pag')}</p>}

      {state.status === 'ready' && (
        <>
          <SummaryCards summary={state.data.summary} />

          <CollapsibleCard id="seo-audit-filters" title={t('se.lit.filters')}>
            <FilterControls filters={filters} collections={collections} onChange={onChange} />
          </CollapsibleCard>

          <section className="sa-results" aria-label={t('se.lit.audit_results')}>
            <h2 className="sa-results__heading">Results ({visible.length})</h2>
            <div className="sa-savebar">
              <button type="button" onClick={saveEdits} disabled={saving || pending.length === 0}>
                {saving ? 'Saving...' : `Save ${pending.length} ${pending.length === 1 ? 'change' : 'changes'}`}
              </button>
              {pending.length > 0 && (
                <button type="button" onClick={() => { setEdits({}); setErrors({}) }} disabled={saving}>
                  Discard changes
                </button>
              )}
              {notice && <span role="status">{notice}</span>}
            </div>
            {state.data.rows.length === 0 && <p className="sa-muted">{t('se.lit.nothing_to_check_yet_publish_a_page_post')}</p>}
            {state.data.rows.length > 0 && visible.length === 0 && <p className="sa-muted">{t('se.lit.no_items_match_these_filters')}</p>}
            {visible.length > 0 && <AuditTable rows={visible} edits={edits} errors={errors} onEdit={onEdit} />}
          </section>
        </>
      )}
    </div>
  )
}
