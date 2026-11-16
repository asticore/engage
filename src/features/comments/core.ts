/**
 * Comments (Task 27), pure parts: validation, the moderation decision, thread building and small display helpers.
 * Nothing here touches a database, so every rule can be tested on its own.
 */

export type CommentStatus = 'pending' | 'approved' | 'spam' | 'trash'
export const COMMENT_STATUSES: readonly CommentStatus[] = ['pending', 'approved', 'spam', 'trash']
export type ModerationMode = 'all' | 'first' | 'rules' | 'open'
export const MODERATION_MODES: readonly ModerationMode[] = ['all', 'first', 'rules', 'open']

export const MAX_CONTENT = 2000
export const MAX_NAME = 60

export type CommentSettings = {
  /** all: hold every comment. first: hold only a person's first comment. rules: hold comments with links. open: publish at once. */
  mode: ModerationMode
  /** Signed-in people are published at once whatever the mode says. */
  signedInAuto: boolean
  /** How many levels of replies are shown (1 means no replies). */
  maxDepth: number
  /** Close comments this many days after a post was published. 0 never closes. */
  closeAfterDays: number
  /** One word or phrase per line. A comment containing one is marked spam. */
  blockedWords: string
}

export const DEFAULT_COMMENT_SETTINGS: CommentSettings = { mode: 'all', signedInAuto: false, maxDepth: 3, closeAfterDays: 0, blockedWords: '' }

export const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

export function cleanSettings(raw: Partial<Record<keyof CommentSettings, unknown>> | null | undefined): CommentSettings {
  const mode = MODERATION_MODES.includes(raw?.mode as ModerationMode) ? (raw?.mode as ModerationMode) : DEFAULT_COMMENT_SETTINGS.mode
  return {
    mode,
    signedInAuto: raw?.signedInAuto === true,
    maxDepth: clampInt(raw?.maxDepth, 1, 5, DEFAULT_COMMENT_SETTINGS.maxDepth),
    closeAfterDays: clampInt(raw?.closeAfterDays, 0, 3650, 0),
    blockedWords: typeof raw?.blockedWords === 'string' ? raw.blockedWords.slice(0, 2000) : '',
  }
}

export type NewComment = { name: string; email: string; content: string }

export function validateComment(input: { name?: unknown; email?: unknown; content?: unknown }): { ok: true; value: NewComment } | { ok: false; error: string } {
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME) : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase().slice(0, 200) : ''
  const content = typeof input.content === 'string' ? input.content.trim() : ''
  if (!name) return { ok: false, error: 'Please enter your name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please enter a valid email address. It is not shown.' }
  if (content.length < 2) return { ok: false, error: 'Please write a comment.' }
  if (content.length > MAX_CONTENT) return { ok: false, error: `Comments can be up to ${MAX_CONTENT} characters.` }
  return { ok: true, value: { name, email, content } }
}

export const countLinks = (text: string): number => (text.match(/https?:\/\/|www\./gi) ?? []).length

export function hitsBlockedWord(text: string, blockedWords: string): boolean {
  const lower = text.toLowerCase()
  return blockedWords
    .split('\n')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
    .some((w) => lower.includes(w))
}

/** What happens to a new comment. A blocked word is spam; then signed-in people and the chosen mode decide. */
export function decideStatus(settings: CommentSettings, ctx: { content: string; signedIn: boolean; hasApprovedBefore: boolean }): CommentStatus {
  if (hitsBlockedWord(ctx.content, settings.blockedWords)) return 'spam'
  if (ctx.signedIn && settings.signedInAuto) return 'approved'
  switch (settings.mode) {
    case 'open':
      return 'approved'
    case 'first':
      return ctx.hasApprovedBefore ? 'approved' : 'pending'
    case 'rules':
      return countLinks(ctx.content) > 0 ? 'pending' : 'approved'
    default:
      return 'pending'
  }
}

/** True when the post is old enough that comments are closed. */
export function isClosed(closeAfterDays: number, publishedAt: string | null | undefined, now: Date): boolean {
  if (!closeAfterDays || !publishedAt) return false
  const t = Date.parse(publishedAt)
  return Number.isFinite(t) && now.getTime() - t > closeAfterDays * 86_400_000
}

export type PublicComment = { id: number; parentId: number | null; name: string; content: string; createdAt: string; fromTeam: boolean }
export type CommentNode = PublicComment & { replies: CommentNode[] }

/** Builds the thread. Replies deeper than maxDepth are shown under the deepest allowed comment. Oldest first. */
export function buildTree(rows: readonly PublicComment[], maxDepth: number): CommentNode[] {
  const byId = new Map<number, CommentNode>()
  for (const r of [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)) byId.set(r.id, { ...r, replies: [] })
  const depth = new Map<number, number>()
  const roots: CommentNode[] = []
  for (const node of byId.values()) {
    const parent = node.parentId !== null ? byId.get(node.parentId) : undefined
    if (!parent) {
      depth.set(node.id, 1)
      roots.push(node)
      continue
    }
    const d = depth.get(parent.id) ?? 1
    if (d >= maxDepth) {
      // Too deep: sit beside the parent, under the nearest ancestor that still has room (or at the top).
      let home: CommentNode | undefined = parent.parentId !== null ? byId.get(parent.parentId) : undefined
      while (home && (depth.get(home.id) ?? 1) >= maxDepth) home = home.parentId !== null ? byId.get(home.parentId) : undefined
      depth.set(node.id, d)
      if (home) home.replies.push(node)
      else roots.push(node)
    } else {
      depth.set(node.id, d + 1)
      parent.replies.push(node)
    }
  }
  return roots
}

export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || '?'

/** A one way hash of an address, so repeat posters can be rate limited without keeping the address itself. */
export async function hashAddress(ip: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${secret}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}
