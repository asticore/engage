import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement as h } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const nav = vi.hoisted(() => ({
  state: { collapsed: false, navOpen: false, toggleSidebar: vi.fn() },
}))

vi.mock('@/admin/context', () => ({ useNav: () => nav.state }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/admin' }))
vi.mock('@/admin/adminRoute/AdminLink', () => ({
  AdminLink: ({ path, children, ...rest }: { path?: string; children?: unknown } & Record<string, unknown>) =>
    h('a', { href: `/admin${path ?? ''}`, ...rest }, children as never),
}))

import { AdminUiProvider } from '@/admin/i18n/AdminUiProvider'
import { ThemeProvider } from '@/admin/context/ThemeContext'
import { AdminTopBar } from '@/admin/ui/AdminTopBar'
import { NavToggler } from '@/admin/ui/NavToggler'
import { ThemeToggler } from '@/admin/ui/ThemeToggler'
import { MyPreferencesLink } from '@/admin/ui/MyPreferencesLink'
import { MyPreferencesClient } from '@/admin/ui/MyPreferencesClient'
import { ADMIN_TOUR_START_EVENT } from '@/features/adminTour/steps'
import { UI_STRING_SOURCE } from '@/features/uiStrings/keys'
import { CUSTOM_ADMIN_VIEWS } from '@/admin/adminViewRegistry'

const wrap = (child: unknown) =>
  h(
    AdminUiProvider,
    { locale: 'en', dir: 'ltr', dict: UI_STRING_SOURCE as never, children: null },
    h(ThemeProvider, { children: child as never }),
  )

const root = (path: string) => readFileSync(join(__dirname, '..', '..', path), 'utf8')

describe('admin shell chrome', () => {
  beforeEach(() => {
    nav.state = { collapsed: false, navOpen: false, toggleSidebar: vi.fn() }
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
  })
  afterEach(() => cleanup())

  it('mobile top bar shows the site name and its hamburger toggles the drawer', () => {
    render(wrap(h(AdminTopBar, { siteName: 'Grace & Gatsby' })))
    expect(screen.getByText('Grace & Gatsby')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Open menu' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(nav.state.toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('hamburger css draws three visible lines and animates to an X, honouring reduced motion', () => {
    const css = root('src/app/(engage)/custom.css')
    expect(css).toMatch(/\.admin-topbar__menu \.hamburger__line\s*\{[^}]*height:\s*2px[^}]*background-color:\s*currentColor/)
    expect(css).toMatch(/\.hamburger--active \.hamburger__line:nth-child\(1\)\s*\{[^}]*rotate\(45deg\)/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.admin-topbar__menu \.hamburger__line\s*\{\s*transition: none/)
  })

  it('top bar renders three hamburger lines', () => {
    const { container } = render(wrap(h(AdminTopBar, { siteName: 'X' })))
    expect(container.querySelectorAll('.admin-topbar__menu .hamburger__line')).toHaveLength(3)
  })

  it('Escape closes the mobile drawer and returns focus to the hamburger', async () => {
    const { NavProvider, useNav } = await vi.importActual<typeof import('@/admin/context/NavContext')>('@/admin/context/NavContext')
    const originalMatchMedia = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never
    const Probe = () => {
      const { navOpen, setNavOpen } = useNav()
      return h('div', null, h('button', { className: 'admin-topbar__menu', id: 'hb' }, 'menu'), h('button', { id: 'open', onClick: () => setNavOpen(true) }, 'open'), h('span', { 'data-testid': 'state' }, String(navOpen)))
    }
    render(h(NavProvider, null, h(Probe)))
    fireEvent.click(document.getElementById('open') as HTMLElement)
    expect(screen.getByTestId('state').textContent).toBe('true')
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(screen.getByTestId('state').textContent).toBe('false')
    expect(document.activeElement?.id).toBe('hb')
    window.matchMedia = originalMatchMedia
  })

  it('top bar offers Close menu while the drawer is open', () => {
    nav.state.navOpen = true
    render(wrap(h(AdminTopBar, { siteName: 'X' })))
    expect(screen.getByRole('button', { name: 'Close menu' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('sidebar collapse button reflects the collapsed state and keeps the nav-toggler class', () => {
    const { rerender } = render(wrap(h(NavToggler)))
    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(collapse.className).toBe('nav-toggler')
    fireEvent.click(collapse)
    expect(nav.state.toggleSidebar).toHaveBeenCalled()
    nav.state.collapsed = true
    rerender(wrap(h(NavToggler)))
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy()
  })

  it('sidebar theme toggle flips light and dark and keeps the theme-toggler class', () => {
    render(wrap(h(ThemeToggler)))
    const toDark = screen.getByRole('button', { name: 'Switch to dark mode' })
    expect(toDark.className).toContain('theme-toggler')
    act(() => {
      fireEvent.click(toDark)
    })
    expect(document.documentElement.dataset.theme).toBe('dark')
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    })
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('sidebar link points at My preferences', () => {
    render(wrap(h(MyPreferencesLink, { name: 'Pat' })))
    const link = screen.getByRole('link', { name: 'My preferences' })
    expect(link.getAttribute('href')).toBe('/admin/settings/my-preferences')
    expect(link.textContent).toBe('Pat')
  })
})

describe('My preferences page', () => {
  afterEach(() => cleanup())

  it('is registered as an admin view under settings', () => {
    const view = CUSTOM_ADMIN_VIEWS.find((v) => v.key === 'myPreferences')
    expect(view?.path).toBe('/settings/my-preferences')
  })

  it('holds language, theme and tour, and the tour button dispatches the start event', () => {
    const listener = vi.fn()
    window.addEventListener(ADMIN_TOUR_START_EVENT, listener)
    render(wrap(h(MyPreferencesClient, { userId: 7, adminLanguage: 'auto' })))
    expect(screen.getByRole('combobox')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Replay the admin tour' }))
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(ADMIN_TOUR_START_EVENT, listener)
  })

  it('saves the language to the signed-in user own record only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    render(wrap(h(MyPreferencesClient, { userId: 7, adminLanguage: 'auto' })))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'de' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/users/7', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ adminLanguage: 'de' }) }))
    vi.unstubAllGlobals()
  })
})

describe('shell wiring', () => {
  it('RootLayout no longer floats the toggles and mounts the top bar', () => {
    const layout = root('src/admin/RootLayout.tsx')
    expect(layout).not.toContain('<ThemeToggler')
    expect(layout).not.toContain('<NavToggler')
    expect(layout).toContain('<AdminTopBar')
  })

  it('the sidebar holds the toggles and the language picker is gone from it', () => {
    const navSource = root('src/components/admin/nav/AdminNav.tsx')
    expect(navSource).toContain('<NavToggler')
    expect(navSource).not.toContain('<ThemeToggler')
    expect(navSource).toContain('<MyPreferencesLink')
    expect(navSource).not.toContain('AdminLanguagePicker')
    expect(navSource).toContain('__wrap')
  })

  it('the visual editor hides every piece of shell chrome', () => {
    const css = root('src/views/visualEditor/veShell.css')
    for (const cls of ['.nav-toggler', '.theme-toggler', '.admin-topbar']) expect(css).toContain(cls)
    expect(root('src/app/(engage)/custom.css')).toContain('.admin-shell:has(.ve-root) .admin-topbar')
  })
})
