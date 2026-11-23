import { describe, expect, it } from 'vitest'
import { cloudStep, termCounts } from '@/components/blocks/elements/Wave70Server'

const posts = [
  { categories: [{ name: 'News' }, { name: 'News' }], tags: [{ name: 'A b' }] },
  { categories: [{ name: 'News' }, { name: 'Tips' }], tags: [{ name: 'a b' }, { name: 'C' }] },
  { categories: [{ name: 'Tips' }] },
]
describe('taxonomy list', () => {
  it('counts a post once per term', () => {
    expect(termCounts(posts, 'categories', 'count', 10).map((t) => [t.slug, t.count])).toEqual([['news', 2], ['tips', 2]])
    expect(termCounts(posts, 'tags', 'name', 10).map((t) => [t.slug, t.count])).toEqual([['a-b', 2], ['c', 1]])
  })
  it('limits and clamps', () => {
    expect(termCounts(posts, 'categories', 'name', 1)).toHaveLength(1)
  })
  it('cloud steps', () => {
    expect(cloudStep(1, 1, 9)).toBe(1)
    expect(cloudStep(9, 1, 9)).toBe(5)
    expect(cloudStep(4, 4, 4)).toBe(3)
  })
})
