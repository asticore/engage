import { describe, expect, it } from 'vitest'

import { fallbackKeys, planAttempts } from '@/features/email/failover'
import { mergeConnections } from '@/features/email/connections'
import { authPlain, buildMime, dotStuff, parseReplyLine } from '@/features/email/providers/smtpMime'
import { resolveProvider } from '@/features/email/providers'

const message = { to: ['a@example.com'], subject: 'Héllo', html: '<p>Hi</p>', text: 'Hi', fromEmail: 'me@example.com', fromName: 'Me' }

describe('smtp message text', () => {
  it('builds a multipart message with both parts and an encoded subject', () => {
    const mime = buildMime(message, 'B')
    expect(mime).toContain('Content-Type: multipart/alternative; boundary="B"')
    expect(mime).toContain('Subject: =?UTF-8?B?')
    expect(mime).toContain('Content-Type: text/plain')
    expect(mime).toContain('Content-Type: text/html')
    expect(mime).toContain('From: Me <me@example.com>')
  })
  it('cannot be given a second header through the subject or a recipient', () => {
    const mime = buildMime({ ...message, subject: 'x\r\nBcc: evil@example.com', to: ['a@example.com\r\nBcc: e@example.com'] }, 'B')
    expect(mime).not.toMatch(/^Bcc:/m)
  })
  it('doubles a leading dot, parses replies and builds AUTH PLAIN', () => {
    expect(dotStuff('a\r\n.b\r\n..c')).toBe('a\r\n..b\r\n...c')
    expect(parseReplyLine('250-STARTTLS')).toEqual({ code: 250, last: false, text: 'STARTTLS' })
    expect(parseReplyLine('250 OK')?.last).toBe(true)
    expect(parseReplyLine('nonsense')).toBeNull()
    expect(atob(authPlain('u', 'p'))).toBe('\0u\0p')
  })
})

describe('smtp provider and ordered fallbacks', () => {
  it('needs a host', () => {
    expect(resolveProvider('smtp', {}).missing).toEqual(['SMTP host'])
    expect(resolveProvider('smtp', { smtp: { host: 'smtp.example.com' } }).send).not.toBeNull()
  })
  it('orders the single fallback, then the list, without repeats or unknown keys', () => {
    expect(fallbackKeys({ fallbackProvider: 'sendgrid', fallbackOrder: 'smtp, sendgrid, nope, resend' })).toEqual(['sendgrid', 'smtp', 'resend'])
    expect(fallbackKeys({ fallbackProvider: 'none' })).toEqual([])
  })
  it('plans the default then every connected fallback in order', () => {
    const settings = mergeConnections({ defaultProvider: 'resend', fallbackProvider: 'sendgrid', fallbackOrder: 'smtp,resend', resend: { apiKey: 'k' }, sendgrid: { apiKey: 's' }, smtp: { host: 'h' } }, null)
    expect(planAttempts(settings).attempts.map((a) => a.provider)).toEqual(['resend', 'sendgrid', 'smtp'])
  })
})
