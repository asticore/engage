import { describe, expect, it } from 'vitest'

import { exportWebhooks, parseWebhookImport } from '@/features/webhooks/transfer'

const hook = { name: 'Orders', description: 'd', url: 'https://example.com/hook', events: ['order.created'] as never, template: null as string | null, enabled: true, ratePerMinute: 30 }

describe('webhook transfer', () => {
  it('exports settings only', () => {
    const out = exportWebhooks([{ ...hook, secret: 'enc:v1:x', id: 4 } as never])
    expect(JSON.stringify(out)).not.toContain('enc:v1')
    expect(out.webhooks[0]).not.toHaveProperty('id')
  })
  it('imports switched off and skips bad rows', () => {
    const text = JSON.stringify({ format: 'engage-webhooks', version: 1, webhooks: [hook, { ...hook, name: 'Bad', url: 'http://localhost/x' }] })
    const r = parseWebhookImport(text)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.webhooks).toHaveLength(1)
      expect(r.webhooks[0].enabled).toBe(false)
      expect(r.skipped[0]).toContain('Bad')
    }
  })
  it('refuses other files and respects room', () => {
    expect(parseWebhookImport('nope').ok).toBe(false)
    expect(parseWebhookImport('{"format":"x","webhooks":[]}').ok).toBe(false)
    const r = parseWebhookImport(JSON.stringify({ format: 'engage-webhooks', webhooks: [hook, hook] }), 1)
    expect(r.ok && r.webhooks.length).toBe(1)
  })
})
