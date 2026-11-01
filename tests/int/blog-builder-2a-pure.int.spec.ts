// @vitest-environment node
// Blog builder, later slices (task 2a), pure rules: sources, the per-post call limit, the featured image,
// citations in the text and the post body, saved prompts, the brand voice in the prompt, and the gallery match.
import { describe, expect, it } from 'vitest'

import { parseSectionText, parseDetailsReply } from '@/features/blogBuilder/parse'
import { parseBlogRequest, parseSources, DEFAULT_CALL_LIMIT, MAX_SOURCES } from '@/features/blogBuilder/request'
import { citedSourceNumbers, postContent } from '@/features/blogBuilder/content'
import { draftData } from '@/features/blogBuilder/draft'
import { sourcesBlock, systemPrompt } from '@/features/blogBuilder/prompts'
import { addSavedPrompt, MAX_SAVED_PROMPTS, parseSavedPrompts, removeSavedPrompt, serializeSavedPrompts, type SavedPrompt } from '@/features/blogBuilder/savedPrompts'
import { matchMedia, mediaKeywords } from '@/features/blogBuilder/mediaMatch'

const brief = { topic: 'Candle care', audience: 'New owners', tone: 'warm', length: 'short', keywords: 'wax, wick', callToAction: '' }
const prompt = (over: Record<string, unknown> = {}) => ({ id: 'p-1', name: 'Candle care', brief: { topic: 'Candle care', audience: '', tone: 'friendly', length: 'medium', keywords: ['wax'], callToAction: '' }, ...over })

describe('sources', () => {
  it('keeps https links one per line, trimmed and de-duplicated', () => {
    const result = parseSources(' https://example.test/a \n\nhttps://example.test/a\nhttps://example.test/b ')
    expect(result).toEqual({ ok: true, value: ['https://example.test/a', 'https://example.test/b'] })
  })

  it('accepts an empty value as no sources', () => {
    expect(parseSources('')).toEqual({ ok: true, value: [] })
    expect(parseSources(undefined)).toEqual({ ok: true, value: [] })
  })

  it('refuses plain http, bad links, links with spaces or user names, and too many', () => {
    expect(parseSources('http://example.test/a').ok).toBe(false)
    expect(parseSources('not a link').ok).toBe(false)
    expect(parseSources('https://user:pass@example.test/a').ok).toBe(false)
    expect(parseSources('https://example.test/a b').ok).toBe(false)
    const many = Array.from({ length: MAX_SOURCES + 1 }, (_, i) => `https://example.test/${i}`).join('\n')
    expect(parseSources(many).ok).toBe(false)
  })

  it('reads sources from the request and refuses a bad list there', () => {
    const ok = parseBlogRequest({ action: 'section', brief, title: 'T', outline: [{ heading: 'H', notes: '' }], index: 0, sources: ['https://example.test/a'] })
    expect(ok.ok && ok.value.sources).toEqual(['https://example.test/a'])
    expect(parseBlogRequest({ action: 'titles', brief, sources: ['http://x.test'] }).ok).toBe(false)
  })
})

describe('per-post AI limit', () => {
  it('counts only with a draft key, and falls back to the default limit when the choice is not one of the options', () => {
    const counted = parseBlogRequest({ action: 'titles', brief, draftKey: 'draft-abcdef12', callLimit: 50 })
    expect(counted.ok && counted.value).toMatchObject({ draftKey: 'draft-abcdef12', callLimit: 50 })
    const fallback = parseBlogRequest({ action: 'titles', brief, draftKey: 'draft-abcdef12', callLimit: 7 })
    expect(fallback.ok && fallback.value.callLimit).toBe(DEFAULT_CALL_LIMIT)
    const none = parseBlogRequest({ action: 'titles', brief })
    expect(none.ok && none.value.draftKey).toBeUndefined()
    expect(none.ok && none.value.callLimit).toBeUndefined()
  })

  it('ignores a draft key that is not a plain id', () => {
    const result = parseBlogRequest({ action: 'titles', brief, draftKey: 'a b; drop' })
    expect(result.ok && result.value.draftKey).toBeUndefined()
  })
})

describe('featured image on create', () => {
  const meta = { metaTitle: 'Candle care', metaDescription: 'How to care for candles.', slug: 'candle-care', tags: ['wax'], category: 'Home' }
  const create = (featuredImageId: unknown) => parseBlogRequest({ action: 'create', title: 'Candle care', outline: [{ heading: 'Wax', notes: '' }], sections: ['Text.'], meta, featuredImageId })

  it('accepts a gallery picture id, or none', () => {
    const id = (v: unknown) => {
      const r = create(v)
      return r.ok ? (r.value as { featuredImageId?: unknown }).featuredImageId : 'rejected'
    }
    expect(id(42)).toBe(42)
    expect(id(null)).toBe(null)
    expect(id(undefined)).toBe(null)
  })

  it('refuses a picture id that is not a positive whole number', () => {
    expect(create(-1).ok).toBe(false)
    expect(create('12').ok).toBe(false)
  })

  it('sets the posts featured image only when one was picked', () => {
    const input = { title: 'T', outline: [{ heading: 'H', notes: '' }], sections: ['Text.'], meta }
    expect(draftData({ ...input, featuredImageId: 7 }, 't')).toMatchObject({ featuredImage: 7 })
    expect(draftData({ ...input, featuredImageId: null }, 't')).not.toHaveProperty('featuredImage')
  })
})

describe('citations in the text and the post', () => {
  it('keeps [n] markers that name a source and removes the others', () => {
    expect(parseSectionText('Wax burns clean [1] and wicks matter [4].', 2)).toEqual({ ok: true, value: 'Wax burns clean [1] and wicks matter.' })
    expect(parseSectionText('No sources given [1].', 0)).toEqual({ ok: true, value: 'No sources given.' })
  })

  it('leaves text without markers alone', () => {
    expect(parseSectionText('Plain text, no [citation] brackets.', 3)).toEqual({ ok: true, value: 'Plain text, no [citation] brackets.' })
  })

  it('lists only the cited sources at the end of the post, numbered as in the text', () => {
    expect(citedSourceNumbers(['Wax [2].', 'Wick [2] and [1].'], 3)).toEqual([1, 2])
    const doc = JSON.stringify(postContent([{ heading: 'Wax', notes: '' }], ['Wax [2].'], ['https://example.test/a', 'https://example.test/b']))
    expect(doc).toContain('Sources')
    expect(doc).toContain('[2] https://example.test/b')
    expect(doc).not.toContain('https://example.test/a')
  })

  it('adds no sources heading when nothing is cited', () => {
    expect(JSON.stringify(postContent([{ heading: 'Wax', notes: '' }], ['Wax.'], ['https://example.test/a']))).not.toContain('Sources')
  })
})

describe('prompts', () => {
  it('puts the brand voice in the system prompt, marked as description only', () => {
    expect(systemPrompt({ siteName: 'Candle Co' }, 'Warm and plain.')).toContain('<brand_voice>\nWarm and plain.\n</brand_voice>')
    expect(systemPrompt({ siteName: 'Candle Co' }, '')).not.toContain('brand_voice')
  })

  it('numbers the sources in the prompt and says they are the only ones to cite', () => {
    const block = sourcesBlock(['https://example.test/a', 'https://example.test/b'])
    expect(block).toContain('[1] https://example.test/a')
    expect(block).toContain('[2] https://example.test/b')
    expect(block).toContain('never invent a source')
    expect(sourcesBlock([])).toBe('')
  })

  it('reads the featured image prompt from the details reply', () => {
    const reply = '{"metaTitle":"Candle care","metaDescription":"How to care for candles at home, with simple steps for new owners.","slug":"candle-care","tags":["wax"],"category":"Home","featuredImagePrompt":"A lit candle on a wooden table"}'
    const result = parseDetailsReply(reply, 'Candle care')
    expect(result.ok && result.value.featuredImagePrompt).toBe('A lit candle on a wooden table')
    expect(result.ok && result.value.meta.slug).toBe('candle-care')
  })
})

describe('saved prompts', () => {
  it('adds a named brief and keeps the list when saved again through serialize and parse', () => {
    const added = addSavedPrompt([], { name: '  Candle care  ', brief }, 'p-1')
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(added.value[0]).toMatchObject({ id: 'p-1', name: 'Candle care', brief: { topic: 'Candle care', keywords: ['wax', 'wick'] } })
    expect(parseSavedPrompts(serializeSavedPrompts(added.value))).toEqual(added.value)
  })

  it('refuses an empty or duplicate name, a bad brief, and a full list', () => {
    expect(addSavedPrompt([], { name: '  ', brief }, 'p-1').ok).toBe(false)
    const one = [prompt()] as SavedPrompt[]
    expect(addSavedPrompt(one, { name: 'candle care', brief }, 'p-2').ok).toBe(false)
    expect(addSavedPrompt([], { name: 'Bad', brief: { topic: '' } }, 'p-3').ok).toBe(false)
    const full = Array.from({ length: MAX_SAVED_PROMPTS }, (_, i) => prompt({ id: `p-${i}`, name: `Name ${i}` })) as SavedPrompt[]
    const refused = addSavedPrompt(full, { name: 'One more', brief }, 'p-new')
    expect(refused.ok).toBe(false)
  })

  it('removes one prompt by id', () => {
    const list = [prompt({ id: 'a', name: 'A' }), prompt({ id: 'b', name: 'B' })] as SavedPrompt[]
    expect(removeSavedPrompt(list, 'a').map((p) => p.id)).toEqual(['b'])
  })

  it('drops stored entries that do not check out, and reads bad JSON as none', () => {
    const raw = JSON.stringify([{ id: 'ok-1', name: 'Good', brief }, { id: 'bad id!', name: 'Bad', brief }, { id: 'no-brief', name: 'X' }])
    expect(parseSavedPrompts(raw).map((p) => p.id)).toEqual(['ok-1'])
    expect(parseSavedPrompts('{not json')).toEqual([])
    expect(parseSavedPrompts(null)).toEqual([])
  })
})

describe('gallery match', () => {
  it('turns the title and keywords into words of three letters or more, without stop words', () => {
    expect(mediaKeywords('The Care of Wax candles and wicks')).toEqual(['care', 'wax', 'candles', 'wicks'])
  })

  it('ranks pictures by alt text, then caption, then file name, and skips files that are not images', () => {
    const docs = [
      { id: 1, url: '/a.jpg', alt: 'Lit candle', caption: '', filename: 'x.jpg', mimeType: 'image/jpeg' },
      { id: 2, url: '/b.jpg', alt: '', caption: '', filename: 'candle-wax.jpg', mimeType: 'image/jpeg' },
      { id: 3, url: '/c.pdf', alt: 'candle', caption: '', filename: 'candle.pdf', mimeType: 'application/pdf' },
      { id: 4, url: '/d.jpg', alt: 'Garden', caption: '', filename: 'garden.jpg', mimeType: 'image/jpeg' },
    ]
    const matches = matchMedia(docs, ['candle'])
    expect(matches.map((m) => m.id)).toEqual([1, 2])
  })
})
