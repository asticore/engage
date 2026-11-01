/**
 * Saved prompts for the blog builder: a named brief the admins can reuse. Stored as JSON text on the
 * Integrations global (`blogSavedPrompts`). Pure: parsing, limits and the add and remove rules.
 */

import { parseBrief, type BlogBrief, type ParseResult } from './request'

export const MAX_SAVED_PROMPTS = 20
export const SAVED_PROMPT_NAME_MAX = 60

export type SavedPrompt = { id: string; name: string; brief: BlogBrief }

const ID_RE = /^[A-Za-z0-9-]{1,64}$/

/** Reads the stored JSON (or an already-parsed list). Anything that does not check out is dropped, never repaired. */
export function parseSavedPrompts(raw: unknown): SavedPrompt[] {
  let list: unknown = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return []
    try {
      list = JSON.parse(raw) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  const out: SavedPrompt[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' && ID_RE.test(row.id) ? row.id : null
    const name = typeof row.name === 'string' ? row.name.replace(/\s+/g, ' ').trim().slice(0, SAVED_PROMPT_NAME_MAX) : ''
    const brief = parseBrief(row.brief)
    if (!id || !name || brief.ok === false) continue
    out.push({ id, name, brief: brief.value })
    if (out.length === MAX_SAVED_PROMPTS) break
  }
  return out
}

export function serializeSavedPrompts(list: SavedPrompt[]): string {
  return JSON.stringify(list.slice(0, MAX_SAVED_PROMPTS))
}

/** Adds one prompt. Refuses a full list, an empty or duplicate name, and a brief that does not check out. */
export function addSavedPrompt(list: SavedPrompt[], input: { name: unknown; brief: unknown }, id: string): ParseResult<SavedPrompt[]> {
  const name = typeof input.name === 'string' ? input.name.replace(/\s+/g, ' ').trim() : ''
  if (!name) return { ok: false, error: 'Give the prompt a name.' }
  if (name.length > SAVED_PROMPT_NAME_MAX) return { ok: false, error: `The name can be up to ${SAVED_PROMPT_NAME_MAX} characters.` }
  if (!ID_RE.test(id)) return { ok: false, error: 'The prompt could not be saved. Try again.' }
  const brief = parseBrief(input.brief)
  if (brief.ok === false) return brief
  if (list.length >= MAX_SAVED_PROMPTS) return { ok: false, error: `You can save up to ${MAX_SAVED_PROMPTS} prompts. Delete one first.` }
  if (list.some((prompt) => prompt.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'A saved prompt already has this name.' }
  }
  return { ok: true, value: [...list, { id, name, brief: brief.value }] }
}

export function removeSavedPrompt(list: SavedPrompt[], id: string): SavedPrompt[] {
  return list.filter((prompt) => prompt.id !== id)
}
