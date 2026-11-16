import { describe, expect, it } from 'vitest'

import { replaceEverywhere } from '@/features/dam/replaceEverywhere'
import { usedMessage } from '@/features/dam/safeDelete'
import { replaceAtPaths, versionKey, versionsToPrune } from '@/features/dam/versions'
import { findMediaPaths } from '@/features/media/usage'

describe('stored versions', () => {
  it('keeps versions out of the public file route and out of unsafe names', () => {
    const key = versionKey(12, '2027-03-10T12:30:45.123Z', 'my photo (1).jpg')
    expect(key.startsWith('versions/12/')).toBe(true)
    expect(key).toMatch(/^versions\/12\/\d{1,17}-my_photo_1_.jpg$/)
    expect(key.slice('versions/12/'.length)).not.toContain('/')
    expect(versionKey(1, 'x', '../../etc/passwd').split('/').length).toBe(3)
  })
  it('prunes to the newest few', () => {
    const list = [
      { id: 1, createdAt: '2027-01-01T00:00:00Z' },
      { id: 2, createdAt: '2027-01-03T00:00:00Z' },
      { id: 3, createdAt: '2027-01-02T00:00:00Z' },
      { id: 4, createdAt: '2027-01-03T00:00:00Z' },
    ]
    expect(versionsToPrune(list, 2).map((v) => v.id).sort()).toEqual([1, 3])
    expect(versionsToPrune(list, 10)).toEqual([])
    expect(versionsToPrune(list, 0)).toHaveLength(4)
  })
})

describe('replace everywhere', () => {
  const page = { id: 5, title: 'Home', featuredImage: 7, layout: [{ blockType: 'hero', backgroundImage: { id: 7 }, text: 'x' }, { blockType: 'gallery', images: [7, 9] }], sortOrder: 7 }
  it('rewrites references to the other id and leaves unrelated numbers alone', () => {
    const paths = findMediaPaths(page, 7)
    expect(paths.sort()).toEqual(['featuredImage', 'layout.0.backgroundImage', 'layout.1.images.0'].sort())
    const out = replaceAtPaths(page, paths, 7, 8)
    expect(out.featuredImage).toBe(8)
    expect((out.layout as Array<Record<string, unknown>>)[0].backgroundImage).toBe(8)
    expect((out.layout as Array<Record<string, unknown>>)[1].images).toEqual([8, 9])
    expect(out).not.toHaveProperty('sortOrder')
    expect(page.featuredImage).toBe(7) // input not mutated
  })
  it('keeps string ids as strings', () => {
    expect(replaceAtPaths({ cover: '7' }, ['cover'], 7, 8)).toEqual({ cover: '8' })
  })
  it('updates each document that uses the file and reports failures', async () => {
    const updates: Array<Record<string, unknown>> = []
    const engine = {
      find: async (args: Record<string, unknown>) => {
        if (args.collection === 'pages') return { docs: [page] }
        if (args.collection === 'posts') throw new Error('boom')
        return { docs: [] }
      },
      findGlobal: async (): Promise<null> => null,
      update: async (args: Record<string, unknown>): Promise<void> => { updates.push(args) },
    }
    const result = await replaceEverywhere(engine, 7, 8)
    expect(result.changed).toBe(1)
    expect(result.failed).toContain('posts')
    expect(updates[0]).toMatchObject({ collection: 'pages', id: 5, overrideAccess: true })
    expect((updates[0].data as Record<string, unknown>).featuredImage).toBe(8)
  })
})

describe('delete refusal wording', () => {
  it('names the places and says what to do', () => {
    expect(usedMessage(1, ['Home'])).toContain('used in 1 place (Home)')
    expect(usedMessage(5, ['A', 'B', 'C', 'D', 'E'])).toContain('(A, B, C and more)')
    expect(usedMessage(2, [])).toContain('2 places')
  })
})
