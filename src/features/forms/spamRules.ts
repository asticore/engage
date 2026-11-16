/**
 * Spam rules for form submissions (Task 26b): blocked words, a link limit and blocked senders.
 * Pure, so every rule can be tested without a database. A hit is reported as a reason; the caller discards the
 * submission the same way as a honeypot hit, so a bot learns nothing.
 */

import type { SpamVerdict } from './spam'

const lines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean)

export const countLinks = (text: string): number => (text.match(/https?:\/\/|www\./gi) ?? []).length

/** Every string in a submission, flattened. */
export function collectText(values: Record<string, unknown>): string[] {
  const out: string[] = []
  const walk = (v: unknown): void => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
  }
  Object.values(values).forEach(walk)
  return out
}

/** True when the address equals a blocked entry or ends with a blocked domain. */
export function senderBlocked(email: string, blockedSenders: string): boolean {
  const e = email.trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return false
  const domain = e.slice(at + 1)
  return lines(blockedSenders).some((entry) => {
    const d = entry.replace(/^@/, '')
    return entry === e || (!entry.includes('@') || entry.startsWith('@')) && (domain === d || domain.endsWith(`.${d}`))
  })
}

export function checkSpamRules(values: Record<string, unknown>, rules: { blockedWords: string; maxLinks: number; blockedSenders: string }): SpamVerdict {
  const texts = collectText(values)
  const joined = texts.join('\n').toLowerCase()
  if (rules.blockedWords && lines(rules.blockedWords).some((w) => joined.includes(w))) return { spam: true, reason: 'rules', detail: 'blocked word' }
  if (rules.maxLinks > 0 && texts.reduce((n, t) => n + countLinks(t), 0) > rules.maxLinks) return { spam: true, reason: 'rules', detail: 'too many links' }
  if (rules.blockedSenders && texts.some((t) => /^[^\s@]+@[^\s@]+$/.test(t.trim()) && senderBlocked(t, rules.blockedSenders))) return { spam: true, reason: 'rules', detail: 'blocked sender' }
  return { spam: false }
}
