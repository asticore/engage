import { describe, expect, it } from 'vitest'

import { fillCountdownTargets } from '@/features/site/screenCountdown'
import { SITE_TEMPLATE_KINDS } from '@/collections/SiteTemplates'
import { OPTIONAL_KINDS, TEMPLATE_TYPE_TABS } from '@/features/siteTemplates/kinds'
import { STARTERS } from '@/features/siteTemplates/starters'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'
import { getElementDef } from '@/lib/elements/registry'

const LAUNCH = '2027-01-31T18:00:00.000Z'
const countdown = (target: string) => ({ blockType: 'element', elementType: 'countdown', props: { target } })

describe('maintenance and coming soon screen templates', () => {
  it('are template kinds, optional, and grouped on one dashboard tab', () => {
    for (const kind of ['maintenance', 'coming-soon'] as const) {
      expect(SITE_TEMPLATE_KINDS).toContain(kind)
      expect(OPTIONAL_KINDS).toContain(kind)
    }
    expect(TEMPLATE_TYPE_TABS.find((tab) => tab.id === 'screens')?.kinds).toEqual(['maintenance', 'coming-soon'])
  })

  it('each has a starter built from registered elements', () => {
    for (const kind of ['maintenance', 'coming-soon'] as const) expect(STARTERS.some((s) => s.kind === kind)).toBe(true)
    const json = JSON.stringify(STARTERS.find((s) => s.kind === 'coming-soon')?.blocks())
    expect(json).toContain('coming-soon-signup')
    expect(json).toContain('countdown')
  })

  it('registers the signup as a server element', () => {
    expect(getElementDef('coming-soon-signup')).toBeTruthy()
    expect(SITE_ELEMENT_TYPES.has('coming-soon-signup')).toBe(true)
  })

  it('fills a blank countdown date with the launch date, including inside sections', () => {
    const blocks = [countdown(''), { blockType: 'section', columns: [{ width: 12, blocks: [countdown('  '), countdown('2030-01-01T00:00')] }] }]
    const out = fillCountdownTargets(blocks, LAUNCH) as Array<Record<string, any>>
    expect(out[0].props.target).toBe(LAUNCH)
    expect(out[1].columns[0].blocks[0].props.target).toBe(LAUNCH)
    expect(out[1].columns[0].blocks[1].props.target).toBe('2030-01-01T00:00')
  })

  it('leaves the blocks alone with no launch date', () => {
    const blocks = [countdown('')]
    expect(fillCountdownTargets(blocks, null)).toBe(blocks)
  })
})

describe('staging blocks other outgoing calls', () => {
  it('sends no text, no push and no webhook on a staging site', async () => {
    process.env.SITE_ENV = 'staging'
    try {
      const { sendSms } = await import('@/features/sms')
      const sms = await sendSms('+61400000000', 'hello')
      expect(sms).toMatchObject({ ok: false, reason: 'turned-off' })

      const { pushToAll } = await import('@/features/push/send')
      const fetcher = (async () => new Response(null, { status: 201 })) as unknown as typeof fetch
      const push = await pushToAll([{ endpoint: 'https://push.example/x', p256dh: 'a', auth: 'b' } as never], { title: 't', body: 'b' }, {} as never, 'mailto:a@b.c', fetcher)
      expect(push).toEqual({ sent: 0, removed: [], failed: 0 })
    } finally {
      delete process.env.SITE_ENV
    }
  })
})
