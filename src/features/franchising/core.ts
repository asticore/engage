/** Franchising (Task 22d): the pure rules. No database or engine imports. */

import { normaliseHost } from '@/features/domains/host'

export type FranchiseStatus = 'active' | 'paused'
export type LockChoice = 'none' | 'structure' | 'full'
export const LOCK_CHOICES: { value: LockChoice; label: string }[] = [
  { value: 'structure', label: 'Fixed layout: the franchise can change text only' },
  { value: 'full', label: 'Fully locked: the franchise cannot change the page' },
  { value: 'none', label: 'Not locked: the franchise can edit freely' },
]

export const MAX_FRANCHISES = 200
export const MAX_NAME = 80
export const toStatus = (v: unknown): FranchiseStatus => (v === 'paused' ? 'paused' : 'active')
export const toLockChoice = (v: unknown): LockChoice => (v === 'full' || v === 'none' ? v : 'structure')

export const cleanName = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '')

/** The franchise's domain as a bare host, or the reason it cannot be one. */
export function cleanHost(v: unknown): { ok: true; host: string } | { ok: false; error: string } {
  const r = normaliseHost(v)
  return 'host' in r ? { ok: true, host: r.host } : { ok: false, error: r.reason }
}

/** Text fields a franchise may change on a "fixed layout" page. */
export const FRANCHISE_EDITABLE_PROPS = ['heading', 'subheading', 'text', 'title', 'content', 'body', 'description', 'buttonLabel', 'buttonUrl', 'caption', 'alt']

/**
 * The locks value written on a rolled-out page: the template's own section locks stay, and the page as a
 * whole gets the chosen document lock. Admins always pass a lock; nobody else is named, so a franchise
 * editor is held to it.
 */
export function franchiseLocks(templateLocks: unknown, choice: LockChoice): Record<string, unknown> {
  const base = templateLocks && typeof templateLocks === 'object' && !Array.isArray(templateLocks) ? { ...(templateLocks as Record<string, unknown>) } : {}
  const nodes = base.nodes && typeof base.nodes === 'object' && !Array.isArray(base.nodes) ? base.nodes : {}
  if (choice === 'none') return { nodes, ...(base.document ? { document: base.document } : {}) }
  return {
    nodes,
    document: { mode: choice, unlockRoles: [], editableProps: choice === 'structure' ? FRANCHISE_EDITABLE_PROPS : [], label: 'Set by the head office' },
  }
}

export type RolloutSummary = { created: number; updated: number; failed: number; franchises: number; messages: string[] }
export function describeRollout(s: RolloutSummary): string {
  if (s.franchises === 0) return 'There are no active franchises to roll out to.'
  const parts = [`${s.created} page(s) created`, `${s.updated} updated`]
  if (s.failed > 0) parts.push(`${s.failed} failed`)
  return `Rolled out to ${s.franchises} franchise(s): ${parts.join(', ')}.${s.messages.length ? ' ' + s.messages.slice(0, 3).join(' ') : ''}`
}
