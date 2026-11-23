'use client'

import { AdminLink } from '@/admin/adminRoute/AdminLink'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import React, { useState } from 'react'
import { ForwardEntry } from './ForwardEntry'
import { ResultsMessage, ResultsPager, ResultsStat } from './ResultsChrome'
import { cellText, formatWhen, type PageInfo, type SubmissionColumn, type SubmissionRow } from './rows'
import { useResultsPage } from './useResultsPage'
import { Tooltip } from '@/components/admin/shared/Tooltip'

type SubmissionPage = PageInfo & { columns: SubmissionColumn[]; docs: SubmissionRow[]; truncated?: boolean }

/**
 * The Submissions tab on a form's edit page: one page of entries, newest
 * first, with a column per answer field. The CSV is the existing export for
 * this form, so the file matches the one the Form Submissions screen offers.
 */
export function FormResultsTab({ formId }: { formId: number }) {
  const t = useAdminT()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [applied, setApplied] = useState<Record<string, string>>({})
  const params = new URLSearchParams({ form: String(formId), page: String(page) })
  if (sort) {
    params.set('sort', sort)
    params.set('dir', dir)
  }
  for (const [name, value] of Object.entries(applied)) if (value.trim()) params.set(`f_${name}`, value)
  const { data, error, loading } = useResultsPage<SubmissionPage>(`/api/admin-form-submissions?${params.toString()}`)
  const sortBy = (name: string): void => {
    setPage(1)
    if (sort === name) setDir(dir === 'asc' ? 'desc' : 'asc')
    else {
      setSort(name)
      setDir('asc')
    }
  }
  const mark = (name: string): string => (sort === name ? (dir === 'asc' ? ' \u25B2' : ' \u25BC') : '')
  const filtering = Object.values(applied).some((v) => v.trim())

  const showPayment = data !== null && data.docs.some((row) => row.paymentStatus !== 'none')

  return (
    <section aria-label={t('frm.lit.submissions')} className="et-results">
      <div className="et-toolbar">
        <div className="et-stats">
          <ResultsStat label={t('frm.lit.entries')} value={data ? data.totalDocs.toLocaleString() : '-'} />
        </div>
        <a className="et-button" download href={`/api/form-submissions/export?form=${formId}`}>
          {t('frm.lit.export_csv')}
        </a>
      </div>

      {error && <ResultsMessage kind="error">{t('frm.lit.entries_load_error')}</ResultsMessage>}
      {!error && loading && <ResultsMessage kind="muted">{t('frm.lit.loading_entries')}</ResultsMessage>}
      {data && data.columns.length > 0 && (
        <form
          className="et-toolbar"
          onSubmit={(event) => {
            event.preventDefault()
            setPage(1)
            setApplied(filters)
          }}
        >
          {data.columns.map((column) => (
            <label key={column.name} className="et-nowrap">
              {column.label}{' '}
              <input type="search" value={filters[column.name] ?? ''} onChange={(event) => setFilters({ ...filters, [column.name]: event.target.value })} />
            </label>
          ))}
          <button type="submit" className="et-button">Filter</button>
          {filtering && (
            <button type="button" className="et-button" onClick={() => { setFilters({}); setApplied({}); setPage(1) }}>
              Clear
            </button>
          )}
        </form>
      )}
      {data?.truncated && <ResultsMessage kind="muted">Sorted and filtered over the newest 2,000 entries.</ResultsMessage>}
      {data && !error && data.docs.length === 0 && !filtering && <ResultsMessage kind="muted">{t('frm.lit.no_one_has_sent_this_form_yet')}</ResultsMessage>}

      {data && !error && data.docs.length > 0 && (
        <>
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th scope="col" className="et-nowrap" aria-sort={sort === 'submittedAt' ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    <button type="button" className="et-link-button" onClick={() => sortBy('submittedAt')}>{t('frm.lit.submitted')}{mark('submittedAt')}</button>
                  </th>
                  {data.columns.map((column) => (
                    <th key={column.name} scope="col" aria-sort={sort === column.name ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                      <button type="button" className="et-link-button" onClick={() => sortBy(column.name)}>{column.label}{mark(column.name)}</button>
                    </th>
                  ))}
                  {showPayment && <th scope="col">{t('frm.lit.payment')}</th>}
                  <th scope="col"><span className="et-sr">{t('frm.lit.open')}</span></th>
                </tr>
              </thead>
              <tbody>
                {data.docs.map((row) => (
                  <tr key={row.id}>
                    <td className="et-nowrap">{formatWhen(row.submittedAt)}</td>
                    {data.columns.map((column) => {
                      const text = cellText(row.values[column.name])
                      return (
                        <td className="et-clip" key={column.name}><Tooltip text={text}><span>
                          {text}
                        </span></Tooltip></td>
                      )
                    })}
                    {showPayment && <td className="et-nowrap">{row.paymentStatus}</td>}
                    <td className="et-nowrap">
                      <AdminLink path={`/other/form-submissions/${row.id}`}>{t('frm.lit.open')}</AdminLink>
                      <ForwardEntry entryId={row.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ResultsPager info={data} onPage={setPage} />
        </>
      )}
    </section>
  )
}
