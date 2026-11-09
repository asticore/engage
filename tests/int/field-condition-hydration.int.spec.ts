// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act } from 'react'

// The Workers runtime refuses `new Function`, so on the server a stringified `admin.condition` cannot be
// revived. This mock reproduces that: revival fails on the server pass and works in the browser pass.
const env = vi.hoisted(() => ({ serverPass: false }))
vi.mock('@/admin/fields/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/admin/fields/shared')>()
  return { ...actual, reviveCondition: (source: string) => (env.serverPass ? undefined : actual.reviveCondition(source)) }
})

import { FormProvider, type FieldsMap } from '@/admin/context/FormContext'
import { FieldRenderer } from '@/admin/fields/FieldRenderer'
import type { Field } from '@/engine'

const fields = [
  { name: 'title', type: 'text' },
  { name: 'pagespeedScore', type: 'text', admin: { condition: '() => false' } },
  { name: 'extra', type: 'text', admin: { condition: '(data) => Boolean(data && data.title === "Home")' } },
] as unknown as Field[]

// createElement's overloads want `children` as a prop; it is passed as the third argument below.
const Provider = FormProvider as React.ComponentType<{ initialFields?: FieldsMap; children?: React.ReactNode }>
const Form: React.FC = () =>
  React.createElement(
    Provider,
    { initialFields: { title: { value: 'Home' } } },
    React.createElement(FieldRenderer, { fields }),
  )
const tree = () => React.createElement(Form)

describe('conditional fields hydrate cleanly', () => {
  it('server (cannot revive conditions) and browser agree, then the browser applies the conditions', async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    env.serverPass = true
    const html = renderToString(tree())
    env.serverPass = false
    expect(html).not.toContain('pagespeedScore')
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
    }
    expect(errs.filter((e) => /hydrat|did not match|#418/i.test(e))).toEqual([])
    expect(container.querySelector('[name="pagespeedScore"]')).toBeNull()
    expect(container.querySelector('[name="extra"]')).not.toBeNull()
  })
})
