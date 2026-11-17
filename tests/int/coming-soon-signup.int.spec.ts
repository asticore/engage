// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// No D1 binding in tests: the engine stub below stands in for it.
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => {
    throw new Error('no cloudflare context in tests')
  },
}))

import { formsBeforeChange } from '@/features/forms/configHooks'
import { COMING_SOON_FORM_FIELDS, comingSoonSignupOpen, ensureComingSoonForm } from '@/features/forms/comingSoon'
import { COMING_SOON_FORM_KEY, COMING_SOON_FORM_TITLE } from '@/features/forms/comingSoonKey'
import { isEmbedKey, loadPublishedForm } from '@/features/forms/server'
import { handleSubmission, type SubmitEngine } from '@/features/forms/submit'
import { COMING_SOON_SIGNUP_KEYS } from '@/features/forms/comingSoonSignup'
import { UI_STRING_SOURCE, type UiStringKey } from '@/features/uiStrings'
import { resetRateLimiter } from '@/features/security/rateLimit'
import type { FormDoc } from '@/features/forms/types'

type Row = Record<string, unknown>

const NOW = new Date('2026-11-17T08:00:00Z')

/** An in-memory forms and entries store, answering the calls the signup path makes. */
function fakeEngine(initialForms: Row[] = []) {
  const forms: Row[] = initialForms.map((row) => ({ ...row }))
  const entries: Row[] = []
  const creates: { collection: string; data: Row; context?: Record<string, unknown> }[] = []
  let nextId = 1
  const matchesEmbedKey = (row: Row, where: Record<string, unknown>) => {
    const clause = where.embedKey as { equals?: unknown } | undefined
    return clause === undefined || row.embedKey === clause.equals
  }
  const engine = {
    creates,
    entries,
    forms,
    logger: { info: (): void => undefined, warn: (): void => undefined, error: (): void => undefined },
    findGlobal: async ({ slug }: { slug: string }) => (slug === 'site-settings' ? { features: { forms: true } } : {}),
    findByID: async ({ id }: { id: number }) => forms.find((row) => row.id === id) ?? null,
    find: async ({ collection, where = {} }: { collection: string; where?: Record<string, unknown> }) => {
      if (collection === 'forms') return { docs: forms.filter((row) => matchesEmbedKey(row, where)) }
      return { docs: [] as Row[] }
    },
    create: async ({ collection, data, context }: { collection: string; data: Row; context?: Record<string, unknown> }) => {
      creates.push({ collection, data, context })
      if (collection === 'forms') {
        // Stands in for the Forms create hook, which reads the built-in key from the context.
        const builtIn = context?.builtInEmbedKey
        const row = { id: nextId++, ...data, embedKey: builtIn === COMING_SOON_FORM_KEY ? COMING_SOON_FORM_KEY : 'randomkey12345' }
        forms.push(row)
        return { id: row.id }
      }
      const row = { id: nextId++, ...data }
      entries.push(row)
      return { id: row.id }
    },
    update: async () => ({}),
    delete: async () => ({}),
  }
  return engine
}

const builtInForm = (extra: Row = {}): Row => ({
  id: 7,
  title: COMING_SOON_FORM_TITLE,
  embedKey: COMING_SOON_FORM_KEY,
  formStatus: 'published',
  fields: COMING_SOON_FORM_FIELDS,
  ...extra,
})

describe('coming soon email signup', () => {
  beforeEach(() => {
    resetRateLimiter()
  })

  it('uses a fixed public key that the form routes accept', () => {
    expect(COMING_SOON_FORM_KEY).toBe('comingsoon')
    expect(isEmbedKey(COMING_SOON_FORM_KEY)).toBe(true)
  })

  it('creates the built-in form once, with the fixed key', async () => {
    const engine = fakeEngine()
    const first = await ensureComingSoonForm(engine as never)
    expect(first?.embedKey).toBe(COMING_SOON_FORM_KEY)
    expect(first?.title).toBe(COMING_SOON_FORM_TITLE)
    expect(first?.formStatus).toBe('published')
    expect(engine.creates).toHaveLength(1)
    expect(engine.creates[0]?.context).toEqual({ builtInEmbedKey: COMING_SOON_FORM_KEY })

    const second = await ensureComingSoonForm(engine as never)
    expect(second?.id).toBe(first?.id)
    expect(engine.creates).toHaveLength(1)
  })

  it('the Forms create hook keeps the fixed key only for the built-in form', async () => {
    const builtIn = { embedKey: undefined as unknown }
    await formsBeforeChange({ data: builtIn, req: { context: { builtInEmbedKey: COMING_SOON_FORM_KEY } }, operation: 'create', originalDoc: undefined } as never)
    expect(builtIn.embedKey).toBe(COMING_SOON_FORM_KEY)

    const ordinary = { embedKey: undefined as unknown }
    await formsBeforeChange({ data: ordinary, req: {}, operation: 'create', originalDoc: undefined } as never)
    expect(ordinary.embedKey).toEqual(expect.any(String))
    expect(ordinary.embedKey).not.toBe(COMING_SOON_FORM_KEY)
  })

  it('finds the built-in form by its public key on the public path', async () => {
    const engine = fakeEngine([builtInForm()])
    const form = await loadPublishedForm(engine as never, COMING_SOON_FORM_KEY)
    expect(form?.id).toBe(7)
  })

  it('stores a signup as an entry of the built-in form', async () => {
    const engine = fakeEngine([builtInForm()])
    const outcome = await handleSubmission(engine as unknown as SubmitEngine, {
      formID: COMING_SOON_FORM_KEY,
      form: builtInForm() as unknown as FormDoc,
      values: { email: 'ada@example.com' },
      renderedAt: NOW.getTime() - 10_000,
      now: NOW,
    })
    expect(outcome.ok).toBe(true)
    expect(engine.entries).toHaveLength(1)
    expect(engine.entries[0]).toMatchObject({ form: 7 })
    expect(JSON.stringify(engine.entries[0])).toContain('ada@example.com')
  })

  it('rejects a signup with an address that is not an email', async () => {
    const engine = fakeEngine([builtInForm()])
    const outcome = await handleSubmission(engine as unknown as SubmitEngine, {
      formID: COMING_SOON_FORM_KEY,
      form: builtInForm() as unknown as FormDoc,
      values: { email: 'not-an-address' },
      renderedAt: NOW.getTime() - 10_000,
      now: NOW,
    })
    expect(outcome.ok).toBe(false)
    expect(outcome.errors?.email).toBeTruthy()
    expect(engine.entries).toHaveLength(0)
  })

  it('shows the signup only while the built-in form is not a draft', () => {
    expect(comingSoonSignupOpen(builtInForm() as unknown as FormDoc)).toBe(true)
    expect(comingSoonSignupOpen(builtInForm({ formStatus: 'draft' }) as unknown as FormDoc)).toBe(false)
    expect(comingSoonSignupOpen(null)).toBe(false)
  })

  it('has every signup string in the reference table', () => {
    for (const key of Object.values(COMING_SOON_SIGNUP_KEYS)) {
      expect(UI_STRING_SOURCE[key as UiStringKey], key).toBeTruthy()
    }
  })
})
