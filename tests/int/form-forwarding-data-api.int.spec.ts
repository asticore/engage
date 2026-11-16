import { describe, expect, it } from 'vitest'

import { normaliseFormConfig } from '@/features/forms/config'
import { parseSubmissionQuery, submissionsQuery, shapeEntry, describeForm } from '@/features/forms/dataApi'
import { signFileLink, verifyFileLink, withFileLinks } from '@/features/forms/fileLinks'
import { forwardSubmission, sendSubmissionEmails } from '@/features/forms/notify'
import { buildPayload, deliver, sampleValues } from '@/features/forms/webhooks'
import type { FormDoc } from '@/features/forms/types'

const form: FormDoc = {
  id: 3,
  title: 'Contact',
  fields: [
    { name: 'dept', label: 'Department', type: 'select', options: [{ label: 'Sales', value: 'Sales' }] },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'cv', label: 'CV', type: 'file' },
  ] as never,
}
const settings = { sendAdminNotification: false, notificationRecipients: '' } as never
type Sent = { to: string | string[]; replyTo?: string; html: string }
const recorder = () => {
  const sent: Sent[] = []
  return { sent, sendEmail: async (args: Sent) => (sent.push(args), { ok: true }) }
}

describe('email routing rules', () => {
  const rule = (extra: Record<string, unknown>) => ({
    ...form,
    formConfig: { notifications: [{ id: 'a', name: 'Sales', recipients: 'sales@x.com', conditions: { enabled: true, match: 'all', action: 'show', rules: [{ field: 'dept', operator: 'equals', value: 'Sales' }] }, ...extra }] },
  })
  it('routes by answer, adds cc, sends bcc separately', async () => {
    const r = recorder()
    await sendSubmissionEmails(rule({ cc: 'boss@x.com', bcc: 'a@x.com, b@x.com' }) as never, { dept: 'Sales', email: 'v@x.com' }, settings, undefined, { sendEmail: r.sendEmail as never })
    expect(r.sent.map((m) => m.to)).toEqual([['sales@x.com', 'boss@x.com'], 'a@x.com', 'b@x.com'])
    expect(r.sent[0].replyTo).toBe('v@x.com')
  })
  it('skips when the condition does not match and can turn reply-to off', async () => {
    const r = recorder()
    await sendSubmissionEmails(rule({}) as never, { dept: 'Support' }, settings, undefined, { sendEmail: r.sendEmail as never })
    expect(r.sent).toHaveLength(0)
    await sendSubmissionEmails(rule({ replyToSubmitter: false }) as never, { dept: 'Sales', email: 'v@x.com' }, settings, undefined, { sendEmail: r.sendEmail as never })
    expect(r.sent[0].replyTo).toBeUndefined()
  })
})

describe('forward one entry', () => {
  it('sends to the typed addresses with the note and reports a failure', async () => {
    const r = recorder()
    const ok = await forwardSubmission(form, { id: 9, values: { dept: 'Sales' } }, { to: 'new@x.com', note: 'Please call', sendEmail: r.sendEmail as never })
    expect(ok).toEqual({ ok: true, sent: 1 })
    expect(r.sent[0].html).toContain('Please call')
    const bad = await forwardSubmission(form, { id: 9, values: {} }, { to: 'nonsense', sendEmail: r.sendEmail as never })
    expect(bad.ok).toBe(false)
    const off = await forwardSubmission(form, { id: 9, values: {} }, { to: 'a@x.com', sendEmail: (async () => ({ ok: false, reason: 'disabled', error: 'Email is switched off' })) as never })
    expect(off.ok).toBe(false)
  })
})

describe('webhook options', () => {
  it('normalises the new options', () => {
    const c = normaliseFormConfig({ webhooks: [{ url: 'https://a.com', payload: 'chosen', fields: [' dept ', ''], includeMeta: true, headerName: 'X-Api-Key', headerValue: 'k' }, { url: 'https://b.com', headerName: 'bad name' }] })
    expect(c.webhooks?.[0]).toMatchObject({ payload: 'chosen', fields: ['dept'], includeMeta: true, headerName: 'X-Api-Key' })
    expect(c.webhooks?.[1]).toMatchObject({ payload: 'all', headerName: '' })
  })
  it('limits fields, adds meta and test event', () => {
    const p = buildPayload(form, form.fields as never, 1, { dept: 'Sales', email: 'v@x.com' }, 'now', 'd', { hook: { payload: 'chosen', fields: ['dept'], includeMeta: true }, meta: { sourceUrl: 'https://s.com/p', status: 'new' }, event: 'form.test' })
    expect(p.event).toBe('form.test')
    expect(p.submission.values).toEqual({ dept: 'Sales' })
    expect(p.meta).toEqual({ pageUrl: 'https://s.com/p', status: 'new' })
    expect(sampleValues(form.fields as never).email).toBe('test@example.com')
  })
  it('sends the shared secret header as well as the signature', async () => {
    let headers: Record<string, string> = {}
    const fetcher = (async (_u: string, init: { headers: Record<string, string> }) => ((headers = init.headers), new Response('', { status: 200 }))) as never
    const result = await deliver({ id: 'w', url: 'https://a.com/h', secret: 's', headerName: 'X-Api-Key', headerValue: 'k' }, buildPayload(form, [], 1, {}, 'n', 'd'), 1, fetcher)
    expect(result.ok).toBe(true)
    expect(headers['X-Api-Key']).toBe('k')
    expect(headers['X-Form-Signature']).toMatch(/^t=\d+,v1=/)
  })
})

describe('signed file links', () => {
  it('verifies, expires and refuses tampering', async () => {
    const url = new URL(await signFileLink('secret', 'form-uploads/a.pdf', 'https://s.com', 1_000_000, 100))
    const [key, exp, sig] = ['key', 'exp', 'sig'].map((n) => url.searchParams.get(n) as string)
    expect(await verifyFileLink('secret', key, exp, sig, 1_000_000)).toBe(true)
    expect(await verifyFileLink('secret', key, exp, sig, 1_000_000 + 200_000)).toBe(false)
    expect(await verifyFileLink('secret', 'form-uploads/b.pdf', exp, sig, 1_000_000)).toBe(false)
    expect(await verifyFileLink('other', key, exp, sig, 1_000_000)).toBe(false)
  })
  it('replaces stored files with links and hides the storage key', async () => {
    const out = await withFileLinks({ cv: { key: 'form-uploads/a.pdf', name: 'a.pdf', size: 1, type: 'application/pdf' }, n: 1 }, 'https://s.com', 'secret')
    const file = out.cv as { url?: string; key?: string }
    expect(file.url).toContain('https://s.com/api/form-file-link?')
    expect(file.key).toBeUndefined()
  })
})

describe('data API helpers', () => {
  it('parses paging and dates, rejects bad input', () => {
    const q = parseSubmissionQuery(new URLSearchParams('since=2026-11-01&until=2026-11-02&limit=9999&format=csv'))
    expect(q).toMatchObject({ limit: 200, format: 'csv', since: '2026-11-01T00:00:00.000Z', until: '2026-11-02T23:59:59.999Z' })
    expect(parseSubmissionQuery(new URLSearchParams('since=nope'))).toHaveProperty('error')
    expect(parseSubmissionQuery(new URLSearchParams('status=spam'))).toHaveProperty('error')
  })
  it('excludes spam by default', () => {
    const where = submissionsQuery(3, { page: 1, limit: 5, format: 'json' }) as { and: unknown[] }
    expect(JSON.stringify(where)).toContain('not_equals')
  })
  it('drops internal fields and describes the form', async () => {
    const e = await shapeEntry({ id: 1, ip: '1.2.3.4', notes: 'secret', values: { dept: 'Sales' }, submittedAt: 't' }, '')
    expect(e).not.toHaveProperty('ip')
    expect(e).not.toHaveProperty('notes')
    expect((describeForm(form).fields as { name: string }[]).map((f) => f.name)).toEqual(['dept', 'email', 'cv'])
  })
})
