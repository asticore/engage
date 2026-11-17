import { describe, expect, it } from 'vitest'

import { AFFILIATE_ELEMENTS } from '@/lib/elements/affiliateDefs'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'
import { AFFILIATE_COMPONENTS } from '@/components/blocks/elements/AffiliateServer'
import { TEMPLATE_PRESETS } from '@/views/visualEditor/templatePresets'

describe('affiliate sign-up element (26e)', () => {
  it('is registered as a server element with a renderer and defaults', () => {
    expect(AFFILIATE_ELEMENTS.map((e) => e.type)).toEqual(['affiliate-join'])
    expect(getElementDef('affiliate-join')?.defaultProps()).toEqual({ showSummary: true, showTerms: true, showSignIn: true })
    expect(SITE_ELEMENT_TYPES.has('affiliate-join')).toBe(true)
    expect(AFFILIATE_COMPONENTS['affiliate-join']).toBeTypeOf('function')
  })
  it('has an Affiliates page template that uses it', () => {
    const preset = TEMPLATE_PRESETS.find((p) => p.slug === 'affiliates-page')
    expect(preset?.kind).toBe('page')
    expect(JSON.stringify(preset?.blocks())).toContain('affiliate-join')
  })
})
