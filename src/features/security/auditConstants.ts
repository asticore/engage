import type { AuditAction } from './auditLog'

/** Pure audit constants, kept apart from the writer so client screens can use them without pulling in server code. */
export const AUDIT_TABLE = 'eg_audit_log'

/**
 * Entries the activity log's clear never removes: consent decisions are the
 * proof a visitor agreed (kept for the cookie consent screen and its own
 * retention), privacy requests and erasures are the proof a request was
 * handled, and a clear record is the proof that a clear happened.
 */
export const PROTECTED_AUDIT_ACTIONS: readonly AuditAction[] = [
  'consent.update',
  'privacy.request',
  'privacy.decide',
  'privacy.erase',
  'privacy.export',
  'activity.cleared',
]

/** Noise kept out of the activity screen (blocked probes and rate limits fill it fast). They still live in the table and the retention rule covers them. */
export const ACTIVITY_HIDDEN_ACTIONS: readonly AuditAction[] = ['consent.update', 'rate-limit.blocked', 'probe.blocked', 'ip.blocked', 'api-key.used']
