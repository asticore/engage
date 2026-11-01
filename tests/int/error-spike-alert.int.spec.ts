// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendEmail = vi.fn(async (_args: Record<string, unknown>) => ({ ok: true, provider: 'test' }))
vi.mock('@/features/email', () => ({ sendEmail: (args: Record<string, unknown>) => sendEmail(args) }))

import {
  decideErrorAlert,
  ERROR_ALERT_DEFAULT_THRESHOLD,
  ERROR_ALERT_GAP_MS,
  errorAlertSettingsFrom,
  runErrorSpikeAlert,
} from '@/features/errors/spikeAlert'

const NOW = Date.parse('2026-11-01T12:00:00.000Z')
const ON = { enabled: true, threshold: 10 }

describe('error spike alert rule', () => {
  it('defaults to on with a threshold of 10 when the settings are missing', () => {
    expect(errorAlertSettingsFrom(null)).toEqual({ enabled: true, threshold: ERROR_ALERT_DEFAULT_THRESHOLD })
    expect(errorAlertSettingsFrom({ errorAlerts: { threshold: 'abc' } })).toEqual({ enabled: true, threshold: 10 })
    expect(errorAlertSettingsFrom({ errorAlerts: { threshold: 5000 } }).threshold).toBe(10)
    expect(errorAlertSettingsFrom({ errorAlerts: { enabled: false, threshold: 25 } })).toEqual({ enabled: false, threshold: 25 })
  })

  it('stays quiet when off, below the threshold, or alerted within the last hour', () => {
    expect(decideErrorAlert({ settings: { enabled: false, threshold: 10 }, count: 50, lastSentMs: null, nowMs: NOW }).reason).toBe('off')
    expect(decideErrorAlert({ settings: ON, count: 9, lastSentMs: null, nowMs: NOW }).reason).toBe('below')
    expect(decideErrorAlert({ settings: ON, count: 10, lastSentMs: NOW - ERROR_ALERT_GAP_MS + 1, nowMs: NOW }).reason).toBe('recent')
  })

  it('sends at the threshold, and again once an hour has passed', () => {
    expect(decideErrorAlert({ settings: ON, count: 10, lastSentMs: null, nowMs: NOW }).send).toBe(true)
    expect(decideErrorAlert({ settings: ON, count: 10, lastSentMs: NOW - ERROR_ALERT_GAP_MS, nowMs: NOW }).send).toBe(true)
  })
})

type Doc = Record<string, unknown>

function fakeEngine(opts: { errorsInWindow: number; lastAlertAt?: string; threshold?: number; enabled?: boolean; admins?: string[] }) {
  const counts: Array<Record<string, unknown>> = []
  return {
    counts,
    count: vi.fn(async (args: Record<string, unknown>) => {
      counts.push(args)
      return { totalDocs: opts.errorsInWindow }
    }),
    find: vi.fn(async (args: Record<string, unknown>) => {
      if (args.collection === 'email-log') return { docs: opts.lastAlertAt ? [{ createdAt: opts.lastAlertAt }] : [] }
      if (args.collection === 'users') {
        return { docs: (opts.admins ?? []).map((email) => ({ email, roles: ['admin'] }) as Doc) }
      }
      return { docs: [] }
    }),
    findGlobal: vi.fn(async () => ({ errorAlerts: { enabled: opts.enabled ?? true, threshold: opts.threshold ?? 10 } })),
  }
}

describe('runErrorSpikeAlert', () => {
  beforeEach(() => sendEmail.mockClear())

  it('counts errors first seen in the last 15 minutes and emails every admin once', async () => {
    const engine = fakeEngine({ errorsInWindow: 12, admins: ['a@example.com', 'b@example.com'] })
    const report = await runErrorSpikeAlert(engine as never, new Date(NOW))
    expect(report).toMatchObject({ sent: true, count: 12, reason: 'spike' })
    const countArgs = engine.counts[0] as { collection: string; where: { firstSeen: { greater_than_equal: string } } }
    expect(countArgs.collection).toBe('error-log')
    expect(Date.parse(countArgs.where.firstSeen.greater_than_equal)).toBe(NOW - 15 * 60 * 1000)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: ['a@example.com', 'b@example.com'], template: 'error.spike' })
  })

  it('does not email when an alert already went out within the hour', async () => {
    const engine = fakeEngine({ errorsInWindow: 40, lastAlertAt: new Date(NOW - 20 * 60 * 1000).toISOString(), admins: ['a@example.com'] })
    const report = await runErrorSpikeAlert(engine as never, new Date(NOW))
    expect(report).toMatchObject({ sent: false, reason: 'recent' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('does nothing below the threshold or when the alert is switched off', async () => {
    expect((await runErrorSpikeAlert(fakeEngine({ errorsInWindow: 3, admins: ['a@example.com'] }) as never, new Date(NOW)))).toMatchObject({ sent: false, reason: 'below' })
    expect((await runErrorSpikeAlert(fakeEngine({ errorsInWindow: 99, enabled: false, admins: ['a@example.com'] }) as never, new Date(NOW)))).toMatchObject({ sent: false, reason: 'off' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('uses the threshold from the settings', async () => {
    const report = await runErrorSpikeAlert(fakeEngine({ errorsInWindow: 5, threshold: 5, admins: ['a@example.com'] }) as never, new Date(NOW))
    expect(report.sent).toBe(true)
  })

  it('never throws when the engine fails', async () => {
    const engine = { count: vi.fn(async () => { throw new Error('D1 down') }), find: vi.fn(), findGlobal: vi.fn(async () => null) }
    const report = await runErrorSpikeAlert(engine as never, new Date(NOW))
    expect(report).toMatchObject({ sent: false, error: 'D1 down' })
  })
})
