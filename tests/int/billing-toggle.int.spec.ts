import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PricingTableElement } from '@/components/blocks/elements/MarketingElements'
import { BillingToggleElement } from '@/components/blocks/elements/Wave64Elements'

const price = (p: Record<string, unknown>) => renderToStaticMarkup(createElement(PricingTableElement, p))

describe('billing toggle and yearly prices', () => {
  it('renders both prices when a yearly price is set', () => {
    const html = price({ title: 'Pro', price: '10', period: '/ month', yearlyPrice: '96', yearlyPeriod: '/ year' })
    expect(html).toContain('el-pricing__y')
    expect(html).toContain('96')
    expect(html).toContain('/ year')
  })
  it('stays the single price without a yearly price', () => {
    const html = price({ title: 'Pro', price: '10', period: '/ month' })
    expect(html).not.toContain('el-pricing__y')
  })
  it('the toggle is an accessible switch', () => {
    const html = renderToStaticMarkup(createElement(BillingToggleElement, { saveText: 'Save 20%' }))
    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-checked="false"')
    expect(html).toContain('Save 20%')
  })
})
