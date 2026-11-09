// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act } from 'react'

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/content/pages/2', useRouter: () => ({ push() {}, refresh() {} }) }))

import { AdminUiProvider } from '@/admin/i18n/AdminUiProvider'
import { UI_STRING_SOURCE } from '@/features/uiStrings/keys'
import { DetailsBox, type DocumentPanelInfo } from '@/admin/views/DocumentPanel'

const info = {
  collectionSlug: 'pages',
  id: 2,
  label: 'Page',
  draftsEnabled: true,
  createdAt: '2026-01-02T23:30:00.000Z',
  updatedAt: '2026-03-04T01:15:00.000Z',
  trackAuthorship: true,
  canDelete: true,
  canCreate: true,
  canUpdate: true,
  canPreview: true,
} as DocumentPanelInfo

const tree = () =>
  React.createElement(
    AdminUiProvider,
    { locale: 'en', dir: 'ltr', dict: UI_STRING_SOURCE as never } as never,
    React.createElement(DetailsBox, { info }),
  )

describe('document panel details hydrate cleanly', () => {
  it('server and browser in different time zones log no hydration error', async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const original = process.env.TZ
    process.env.TZ = 'Pacific/Kiritimati'
    const html = renderToString(tree())
    process.env.TZ = 'America/Los_Angeles'
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    const errs: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => {
      errs.push(a.map(String).join(' '))
    })
    try {
      await act(async () => {
        hydrateRoot(container, tree())
      })
    } finally {
      spy.mockRestore()
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    }
    expect(errs.filter((e) => /hydrat|did not match|#418/i.test(e))).toEqual([])
    // After hydration the viewer's own zone applies (Los Angeles: Mar 3, not Mar 4).
    expect(container.textContent).toContain('Mar 3, 2026')
  })
})
