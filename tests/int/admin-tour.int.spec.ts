import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement as h, Fragment } from 'react'

vi.mock('next/navigation', () => ({ usePathname: () => mockPath.value }))

import { AdminTour } from '@/admin/ui/AdminTour'
import { AdminUiProvider } from '@/admin/i18n/AdminUiProvider'
import { UI_STRING_SOURCE } from '@/features/uiStrings/keys'
import {
  ADMIN_TOUR_START_EVENT,
  TOUR_STEPS,
  TOUR_VERSION,
  parseTourPref,
  shouldAutoStart,
} from '@/features/adminTour/steps'
import { loadTourPref, resolveTourAutoStart, saveTourPref } from '@/features/adminTour/preference'

const mockPath = vi.hoisted(() => ({ value: '/admin' }))

const renderTour = (autoStart: boolean) =>
  render(
    h(
      AdminUiProvider,
      { locale: 'en', dir: 'ltr', dict: UI_STRING_SOURCE as never, children: null },
      h(Fragment, null, h('button', { id: 'opener', type: 'button' }, 'opener'), h(AdminTour, { autoStart })),
    ),
  )

describe('admin tour steps', () => {
  it('lists the eight steps in order, centred first and last', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      'welcome', 'sidebar', 'pages', 'visualEditor', 'templates', 'settings', 'features', 'done',
    ])
    expect(TOUR_STEPS[0].target).toBeNull()
    expect(TOUR_STEPS[7].target).toBeNull()
    for (const s of TOUR_STEPS) {
      expect(s.titleKey in UI_STRING_SOURCE).toBe(true)
      expect(s.bodyKey in UI_STRING_SOURCE).toBe(true)
    }
  })

  it('starts by itself only when nothing is stored, whatever the stored version', () => {
    expect(shouldAutoStart(null)).toBe(true)
    expect(shouldAutoStart(undefined)).toBe(true)
    expect(shouldAutoStart({})).toBe(true)
    expect(shouldAutoStart({ version: TOUR_VERSION, status: 'completed', at: 'x' })).toBe(false)
    expect(shouldAutoStart({ version: 0, status: 'skipped', at: 'x' })).toBe(false)
    expect(shouldAutoStart({ version: TOUR_VERSION + 5, status: 'completed', at: 'x' })).toBe(false)
    expect(parseTourPref('nope')).toBeNull()
  })
})

describe('AdminTour component', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockPath.value = '/admin'
    window.sessionStorage.clear()
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    ;(global as any).fetch = fetchMock
  })

  afterEach(() => {
    cleanup()
    document.getElementById('nav-pages')?.remove()
  })

  it('renders nothing when autoStart is false', () => {
    renderTour(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not start by itself on the visual editor route', () => {
    mockPath.value = '/admin/visual-editor/collection/pages/1'
    renderTour(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('auto-starts with an accessible dialog and a missing target falls back to a centred card', () => {
    renderTour(true)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByText('Step 1 of 8')).toBeTruthy()
    expect(dialog.className).toContain('admin-tour__card--centred')
    // Step 2 targets the sidebar, which is not in the page: still centred, no throw.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Step 2 of 8')).toBeTruthy()
    expect(screen.getByRole('dialog').className).toContain('admin-tour__card--centred')
  })

  it('anchors to a visible target', () => {
    const el = document.createElement('a')
    el.id = 'nav-pages'
    el.getBoundingClientRect = () => ({ top: 100, left: 10, width: 120, height: 30, right: 130, bottom: 130, x: 10, y: 100, toJSON: () => ({}) })
    document.body.appendChild(el)
    renderTour(true)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Step 3 of 8')).toBeTruthy()
    expect(screen.getByRole('dialog').className).not.toContain('centred')
    expect(document.querySelector('.admin-tour__ring')).toBeTruthy()
  })

  it('Next, Back and Finish move through steps and Finish saves completed once', () => {
    renderTour(true)
    const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Finish)$/ }))
    expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(true)
    next()
    next()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Step 2 of 8')).toBeTruthy()
    for (let i = 0; i < 6; i++) next()
    expect(screen.getByText('Step 8 of 8')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    next()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin-tour')
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body)).toEqual({ status: 'completed' })
  })

  it('arrow keys move steps while focus is in the dialog', () => {
    renderTour(true)
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' })
    expect(screen.getByText('Step 2 of 8')).toBeTruthy()
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' })
    expect(screen.getByText('Step 1 of 8')).toBeTruthy()
  })

  it('Escape skips and saves skipped exactly once', () => {
    renderTour(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: 'skipped' })
  })

  it('the close button and Skip tour both count as seen', () => {
    renderTour(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close tour' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    cleanup()
    window.sessionStorage.clear()
    renderTour(true)
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not start by itself again in the same session once seen', () => {
    const first = renderTour(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    first.unmount()
    renderTour(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('replays from the start event without saving again', () => {
    renderTour(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    act(() => {
      window.dispatchEvent(new CustomEvent(ADMIN_TOUR_START_EVENT))
    })
    expect(screen.getByText('Step 1 of 8')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the dialog and returns it on close', () => {
    renderTour(false)
    const opener = document.getElementById('opener') as HTMLButtonElement
    opener.focus()
    act(() => {
      window.dispatchEvent(new CustomEvent(ADMIN_TOUR_START_EVENT))
    })
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(opener)
  })

  it('keeps Tab inside the dialog', () => {
    renderTour(true)
    const close = screen.getByRole('button', { name: 'Close tour' })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab' })
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(close)
  })
})

type Row = { id: number; key: string; user: unknown; value?: unknown }

function fakeEngine(rows: Row[]) {
  let nextId = 100
  return {
    rows,
    find: vi.fn(async ({ where }: any) => ({ docs: rows.filter((r) => r.key === where.key.equals) })),
    update: vi.fn(async ({ id, data }: any) => {
      const row = rows.find((r) => r.id === id)!
      row.value = data.value
    }),
    create: vi.fn(async ({ data }: any) => {
      rows.push({ id: nextId++, key: data.key, user: data.user, value: data.value })
    }),
  }
}

describe('admin tour preference (server)', () => {
  const alice = { id: 1 } as never
  const bob = { id: 2 } as never

  it('reads only the signed-in user\'s own row', async () => {
    const engine = fakeEngine([
      { id: 1, key: 'admin-tour', user: [{ relationTo: 'users', value: 2 }], value: { version: 1, status: 'completed', at: 'x' } },
    ])
    expect(await loadTourPref(engine as never, alice)).toBeNull()
    expect((await loadTourPref(engine as never, bob))?.status).toBe('completed')
    expect(await resolveTourAutoStart(engine as never, alice)).toBe(true)
    expect(await resolveTourAutoStart(engine as never, bob)).toBe(false)
    expect(await resolveTourAutoStart(engine as never, null)).toBe(false)
  })

  it('creates the row for the session user, then updates only that row', async () => {
    const engine = fakeEngine([
      { id: 1, key: 'admin-tour', user: [2], value: { version: 1, status: 'completed', at: 'x' } },
    ])
    const saved = await saveTourPref(engine as never, alice, 'skipped')
    expect(saved).toMatchObject({ version: TOUR_VERSION, status: 'skipped' })
    expect(engine.create).toHaveBeenCalledTimes(1)
    expect(engine.create.mock.calls[0][0].data).toMatchObject({ key: 'admin-tour', user: [1] })
    await saveTourPref(engine as never, alice, 'completed')
    expect(engine.update).toHaveBeenCalledTimes(1)
    expect(engine.update.mock.calls[0][0].id).toBe(100)
    // Bob's row was never touched.
    expect((engine.rows[0].value as { status: string }).status).toBe('completed')
    expect(engine.rows[0].user).toEqual([2])
  })

  it('a failed read means the tour does not auto-start', async () => {
    const engine = { find: vi.fn().mockRejectedValue(new Error('db down')) }
    expect(await resolveTourAutoStart(engine as never, alice)).toBe(false)
  })
})
