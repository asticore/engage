/**
 * Tag suggestions for a picture, written by a vision model (Task 14b).
 *
 * The model may only choose from the tags the site already has, so AI never invents
 * tags or changes the tag tree. The reply is parsed defensively: anything that is not
 * a known tag is dropped, and the number of suggestions is capped.
 */

import { callAi, type AiImage } from './client'
import type { AiProvider } from './models'

export const TAG_SUGGEST_MAX = 5

export type SuggestTag = { id: number; path: string }

export function tagSuggestPrompt(tags: SuggestTag[]): string {
  return [
    'Choose the tags that describe this picture from the list below. Use only tags from the list, copied exactly.',
    `Choose at most ${TAG_SUGGEST_MAX}, only ones that clearly apply, and none if nothing fits.`,
    'Reply with a JSON array of the chosen tag names and nothing else, for example ["Food > Dessert","Summer"].',
    'Tags:',
    ...tags.map((t) => `- ${t.path}`),
  ].join('\n')
}

/** Turns a model reply into tag ids: known tags only, no duplicates, at most TAG_SUGGEST_MAX. */
export function parseTagReply(raw: string, tags: SuggestTag[]): number[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  let list: unknown
  try {
    list = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(list)) return []
  const byPath = new Map(tags.map((t) => [t.path.replace(/\s*>\s*/g, ' > ').toLowerCase(), t.id]))
  const out: number[] = []
  for (const item of list) {
    if (typeof item !== 'string') continue
    const id = byPath.get(item.replace(/\s*>\s*/g, ' > ').trim().toLowerCase())
    if (id !== undefined && !out.includes(id)) out.push(id)
    if (out.length >= TAG_SUGGEST_MAX) break
  }
  return out
}

/** Asks the chosen provider which of the site's tags fit one picture. */
export async function suggestTags(provider: AiProvider, image: AiImage, tags: SuggestTag[], apiKey: string, fetchImpl?: typeof fetch): Promise<number[]> {
  const raw = await callAi({ provider, prompt: tagSuggestPrompt(tags), image, maxTokens: 200 }, { apiKey, fetch: fetchImpl })
  return parseTagReply(raw, tags)
}
