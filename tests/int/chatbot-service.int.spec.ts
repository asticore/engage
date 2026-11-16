import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CHATBOT_SETTINGS, type ChatbotSettings } from '@/features/chatbot/core'

const state = vi.hoisted(() => ({
  faqs: [] as Array<{ question: string; answer: string; order?: number }>,
  orders: [] as Array<Record<string, unknown>>,
  keys: { claude: false, openai: false },
  capReached: false,
  aiText: 'NO_ANSWER',
  calls: 0,
  recorded: [] as Array<Record<string, unknown>>,
  suggestions: [] as Array<{ title: string; url: string; type: string; excerpt: string }>,
  ordersWhere: null as unknown,
}))

vi.mock('@/lib/engine', () => ({
  getEngine: async () => ({
    find: async (args: { collection: string; where?: unknown }) => {
      if (args.collection === 'faqs') return { docs: state.faqs }
      if (args.collection === 'orders') {
        state.ordersWhere = args.where
        return { docs: state.orders }
      }
      return { docs: [] }
    },
    findGlobal: async () => ({ siteName: 'Acme' }),
  }),
}))
vi.mock('@/features/ai/keys', () => ({
  aiKeyAvailability: async () => state.keys,
  readAiKey: async () => 'key',
  readBuilderSettings: async () => ({ models: { claude: 'claude-sonnet-4-5', openai: 'gpt-4o' }, capUsd: 0, brandVoice: '', savedPrompts: [] }),
}))
vi.mock('@/features/ai/builderUsage', () => ({
  estimateTokensFromChars: (n: number) => Math.ceil(n / 4),
  readUsageSummary: async () => ({ capReached: state.capReached, capUsd: 5, estCostUsd: 0, month: '2027-01', calls: 0, inputTokens: 0, outputTokens: 0 }),
  recordUsage: async (row: Record<string, unknown>) => void state.recorded.push(row),
}))
vi.mock('@/features/ai/client', () => ({
  AiError: class AiError extends Error {},
  callAiDetailed: async () => {
    state.calls += 1
    return { text: state.aiText, usage: { inputTokens: 100, outputTokens: 20 } }
  },
}))
vi.mock('@/features/search/suggest', () => ({ findSuggestions: async () => state.suggestions }))

import { answerQuestion } from '@/features/chatbot/service'

const ask = (question: string, settings: Partial<ChatbotSettings> = {}, user: { id: number; email: string } | null = null) => answerQuestion({ question, history: [], settings: { ...DEFAULT_CHATBOT_SETTINGS, ...settings }, user })

beforeEach(() => {
  Object.assign(state, { faqs: [{ question: 'How long does shipping take?', answer: 'Orders ship within two business days.' }], orders: [], keys: { claude: false, openai: false }, capReached: false, aiText: 'NO_ANSWER', calls: 0, recorded: [], suggestions: [], ordersWhere: null })
})

describe('chatbot answers', () => {
  it('answers a strong FAQ match with a link and no key', async () => {
    const r = await ask('How long does shipping take?')
    expect(r.via).toBe('faq')
    expect(r.answer).toContain('two business days')
    expect(r.sources).toEqual([{ title: 'How long does shipping take?', url: '/faq' }])
    expect(state.calls).toBe(0)
  })
  it('hands off when nothing matches', async () => {
    const r = await ask('Do you sell unicorns?')
    expect(r.via).toBe('handoff')
    expect(r.handoff?.url).toBe('/contact')
  })
  it('points to pages when only content matches and there is no key', async () => {
    state.suggestions = [{ title: 'Our story', url: '/about', type: 'Page', excerpt: 'Our story and our team' }]
    const r = await ask('Tell me your story')
    expect(r.via).toBe('content')
    expect(r.sources[0]!.url).toBe('/about')
  })
  it('refuses blocked topics before any lookup', async () => {
    const r = await ask('Let us discuss politics', { blockedTopics: 'politics' })
    expect(r.via).toBe('blocked')
    expect(state.calls).toBe(0)
  })
  it('lets the model write from the sources and cites them, and records spend', async () => {
    state.keys = { claude: true, openai: false }
    state.aiText = 'Orders ship in two business days [1].'
    const r = await ask('How long does shipping take?')
    expect(r.via).toBe('ai')
    expect(r.answer).toBe('Orders ship in two business days.')
    expect(r.sources).toEqual([{ title: 'How long does shipping take?', url: '/faq' }])
    expect(state.recorded[0]).toMatchObject({ mode: 'chatbot', ok: true, inputTokens: 100 })
    expect(r.costMicro).toBeGreaterThan(0)
  })
  it('hands off when the model says it has no answer', async () => {
    state.keys = { claude: true, openai: false }
    const r = await ask('How long does shipping take?')
    expect(r.via).toBe('handoff')
  })
  it('does not call the model once the shared cap is reached', async () => {
    state.keys = { claude: true, openai: false }
    state.capReached = true
    const r = await ask('How long does shipping take?')
    expect(state.calls).toBe(0)
    expect(r.via).toBe('faq')
  })
  it('honours the chatbot-only cap', async () => {
    state.keys = { claude: true, openai: false }
    const r = await answerQuestion({ question: 'How long does shipping take?', history: [], settings: { ...DEFAULT_CHATBOT_SETTINGS, capUsd: 1 }, user: null }, { chatbotMicro: 1_500_000 })
    expect(state.calls).toBe(0)
    expect(r.via).toBe('faq')
  })
  it('does not use AI when the admin switched it off', async () => {
    state.keys = { claude: true, openai: false }
    await ask('How long does shipping take?', { useAi: false })
    expect(state.calls).toBe(0)
  })
  it('leaves products out unless recommendations are on', async () => {
    state.suggestions = [{ title: 'Blue mug', url: '/shop/blue-mug', type: 'Product', excerpt: '' }]
    expect((await ask('blue mug')).via).toBe('handoff')
    const on = await ask('blue mug', { recommendations: true })
    expect(on.sources[0]!.url).toBe('/shop/blue-mug')
  })
  it('uses policy pages only when store help is on', async () => {
    state.suggestions = [{ title: 'Returns policy', url: '/returns', type: 'Page', excerpt: 'Returns accepted within 30 days' }]
    expect((await ask('returns policy')).via).toBe('handoff')
    expect((await ask('returns policy', { storeHelp: true })).sources[0]!.url).toBe('/returns')
  })
})

describe('order status', () => {
  const settings = { orderStatus: true }
  it('is off by default', async () => {
    const r = await ask('where is my order?', {}, { id: 7, email: 'a@b.co' })
    expect(r.via).not.toBe('order')
  })
  it('asks a visitor to sign in and reads nothing', async () => {
    const r = await ask('where is my order?', settings)
    expect(r.via).toBe('order')
    expect(r.answer).toContain('sign in')
    expect(state.ordersWhere).toBeNull()
  })
  it('only reads the signed-in customer’s own orders', async () => {
    state.orders = [{ orderNumber: 'A-100', status: 'shipped', createdAt: '2027-01-05T10:00:00Z', amount: 2500, currency: 'usd' }]
    const r = await ask('where is my order?', settings, { id: 7, email: 'a@b.co' })
    expect(state.ordersWhere).toEqual({ customer: { equals: 7 } })
    expect(r.answer).toContain('A-100')
    expect(r.answer).toContain('$25.00')
  })
})
