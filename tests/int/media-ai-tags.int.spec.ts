import { describe, expect, it } from 'vitest'

import { parseTagReply, tagSuggestPrompt, TAG_SUGGEST_MAX } from '@/features/ai/tagSuggest'
import { splitCsv } from '@/features/mediaTags/logic'

const tags = [
  { id: 1, path: 'Food' },
  { id: 2, path: 'Food > Dessert' },
  { id: 3, path: 'Summer' },
  { id: 4, path: 'Winter' },
  { id: 5, path: 'Night' },
  { id: 6, path: 'Beach' },
  { id: 7, path: 'City' },
]

describe('AI tag suggestions (14b)', () => {
  it('lists only the existing tags in the prompt', () => {
    const prompt = tagSuggestPrompt(tags)
    expect(prompt).toContain('- Food > Dessert')
    expect(prompt).toContain('Use only tags from the list')
  })

  it('maps a JSON reply to known tag ids, ignoring case and spacing around >', () => {
    expect(parseTagReply('["food>dessert", "SUMMER"]', tags)).toEqual([2, 3])
  })

  it('drops invented tags, duplicates and non-strings', () => {
    expect(parseTagReply('Sure: ["Summer","Summer","Moon",42,null]', tags)).toEqual([3])
  })

  it('returns nothing for a reply that is not a JSON array', () => {
    expect(parseTagReply('no tags fit', tags)).toEqual([])
    expect(parseTagReply('[oops', tags)).toEqual([])
    expect(parseTagReply('{"a":1}', tags)).toEqual([])
  })

  it('caps the number of suggestions', () => {
    const reply = JSON.stringify(tags.map((t) => t.path))
    expect(parseTagReply(reply, tags)).toHaveLength(TAG_SUGGEST_MAX)
  })
})

describe('splitCsv (14b: imports over one request)', () => {
  it('keeps small CSV text as one piece', () => {
    expect(splitCsv('filename,tags\na.jpg,Summer', 100)).toEqual(['filename,tags\na.jpg,Summer'])
  })

  it('splits on rows, repeats the header and loses no row', () => {
    const rows = Array.from({ length: 50 }, (_, i) => `file-${i}.jpg,Summer`)
    const pieces = splitCsv(['filename,tags', ...rows].join('\n'), 120)
    expect(pieces.length).toBeGreaterThan(1)
    for (const piece of pieces) {
      expect(piece.length).toBeLessThanOrEqual(120)
      expect(piece.startsWith('filename,tags\n')).toBe(true)
    }
    expect(pieces.flatMap((p) => p.split('\n').slice(1))).toEqual(rows)
  })
})
