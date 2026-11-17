import { describe, expect, it } from 'vitest'

import { builtInEmailTemplates } from '@/features/email/builtInTemplates'
import { loadStrings, translateWith } from '@/features/uiStrings'
import { requestHref } from '@/components/blocks/elements/RequestButtonServer'
import { kindLabelOf } from '@/features/quotes/service'
import type { QuoteRequest } from '@/features/quotes/store'

describe('quote text in other languages', () => {
  it('translates the built-in quote emails and keeps their {{tags}}', async () => {
    const de = await builtInEmailTemplates('de')
    const en = await builtInEmailTemplates('en')
    for (const key of ['quoteReceived', 'quoteSent', 'quoteExpiring', 'quoteBidLost'] as const) {
      expect(de[key].subject).not.toBe(en[key].subject)
      const tags = (s: string): string[] => (s.match(/\{\{\w+\}\}/g) ?? []).sort()
      expect(tags(de[key].body)).toEqual(tags(en[key].body))
    }
  })

  it('translates the request kind in the email', async () => {
    await loadStrings('fr')
    const bid = { kind: 'bid' } as QuoteRequest
    expect(kindLabelOf(bid)).toBe('offer')
    expect(kindLabelOf(bid, 'fr')).not.toBe('offer')
  })

  it('gives the request button its language by default and the editor text wins', async () => {
    const dict = await loadStrings('es')
    const defaults = { quote: translateWith(dict, 'store.quote.title.quote'), bid: 'b', item: 'i' }
    expect(requestHref({ kind: 'quote' }, undefined, defaults).text).toBe(defaults.quote)
    expect(requestHref({ kind: 'quote', text: 'Ask us' }, undefined, defaults).text).toBe('Ask us')
  })
})
