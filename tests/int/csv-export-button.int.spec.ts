/* @vitest-environment jsdom */
import { createElement as h } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CsvExportButton, filenameFromDisposition } from '@/admin/list/CsvExportButton'

const HREF = '/api/admin-list-csv?collection=pages'

function csvResponse(body: string, headers: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob([body], { type: 'text/csv' }),
    headers: new Headers({ 'Content-Disposition': 'attachment; filename="pages-2026-11-01.csv"', ...headers }),
  }
}

/** A fetch that waits until the test resolves it, so the exporting state can be seen. */
function deferredFetch() {
  let resolve: (value: unknown) => void = () => undefined
  const pending = new Promise((done) => {
    resolve = done
  })
  global.fetch = vi.fn(() => pending) as unknown as typeof fetch
  return (value: unknown) => resolve(value)
}

describe('CsvExportButton', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:export')
    URL.revokeObjectURL = vi.fn()
    // jsdom cannot navigate to a blob URL; the click is the download trigger, so stub it.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('reads the file name from Content-Disposition, with a fallback', () => {
    expect(filenameFromDisposition('attachment; filename="orders-2026-11-01.csv"', 'x.csv')).toBe('orders-2026-11-01.csv')
    expect(filenameFromDisposition(null, 'x.csv')).toBe('x.csv')
  })

  it('shows an exporting state while the rows are read, then no message on a full export', async () => {
    const finish = deferredFetch()
    render(h(CsvExportButton, { href: HREF, label: 'Export CSV', maxRows: 5000, className: 'btn' }))

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    const busy = await screen.findByRole('button', { name: 'Exporting…' })
    expect(busy.hasAttribute('disabled')).toBe(true)
    expect(busy.getAttribute('aria-busy')).toBe('true')

    await act(async () => finish(csvResponse('a,b\r\n1,2\r\n')))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).not.toBeNull())
    expect(screen.getByRole('status').textContent).toBe('')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('says when the export stopped at the row cap', async () => {
    global.fetch = vi.fn(async () => csvResponse('a\r\n1\r\n', { 'X-Export-Truncated': '1' })) as unknown as typeof fetch
    render(h(CsvExportButton, { href: HREF, label: 'Export CSV', maxRows: 5000 }))

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Only the first 5000 rows were exported. Narrow the filters to get the rest.'),
    )
  })

  it('shows an error message and re-enables the button when the export fails', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, headers: new Headers() })) as unknown as typeof fetch
    render(h(CsvExportButton, { href: HREF, label: 'Export CSV', maxRows: 5000 }))

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('The export could not be downloaded. Try again.'))
    expect(screen.getByRole('button', { name: 'Export CSV' }).hasAttribute('disabled')).toBe(false)
  })
})
