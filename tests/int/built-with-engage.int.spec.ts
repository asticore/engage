// @vitest-environment node
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BuiltWithEngage, ENGAGE_REPO_URL } from '@/components/BuiltWithEngage'
import { Footer as FooterGlobal } from '@/globals/Footer'

describe('Built with Engage footer link', () => {
  it('links to the Engage repository', () => {
    expect(ENGAGE_REPO_URL).toBe('https://github.com/asticore/engage')
    const html = renderToStaticMarkup(React.createElement(BuiltWithEngage))
    expect(html).toContain(`href="${ENGAGE_REPO_URL}"`)
    expect(html).toContain('Built with Engage')
    expect(html).toContain('rel="noopener"')
  })

  it('is a Footer setting that is on by default', () => {
    const field = FooterGlobal.fields.find((f) => 'name' in f && f.name === 'showBuiltWith') as { type: string; defaultValue?: unknown } | undefined
    expect(field?.type).toBe('checkbox')
    expect(field?.defaultValue).toBe(true)
  })

  it('footer defaults carry no sample boutique text', () => {
    const json = JSON.stringify(FooterGlobal.fields)
    expect(json).not.toMatch(/boutique|romantic|Brisbane/i)
  })
})
