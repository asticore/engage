import { describe, expect, it } from 'vitest'

import { addPage, diagramLayout, fillBrief, fillOrder, mergeSuggestions, movePage, nextAfter, normalisePlan, reorderPage, shiftPage, treeOrder, updateSettings, type Plan } from '@/features/sitePlanner/plan'
import { parseSections } from '@/features/sitePlanner/prompts'

const page = (id: string, title: string, parentId: string | null = null, pageId: number | null = null) => ({ id, title, slug: title.toLowerCase(), parentId, brief: '', sections: [] as string[], status: 'idea' as const, pageId })
const plan = (): Plan => normalisePlan({ pages: [page('p1', 'Home'), page('p2', 'About'), page('p3', 'Team', 'p2', 31), page('p4', 'Contact', null, 30)] })
const titles = (p: Plan) => treeOrder(p).map((n) => n.title)

describe('site planner: settings', () => {
  it('keeps brand voice and template through every page edit', () => {
    let p = updateSettings(plan(), { brandVoice: '  warm and plain  ', templateId: 7 })
    expect(p).toMatchObject({ brandVoice: 'warm and plain', templateId: 7 })
    p = addPage(p, 'Blog', null)
    p = movePage(p, 'p4', 'p1')
    p = mergeSuggestions(p, normalisePlan({ pages: [page('x1', 'Pricing')] }))
    expect(p).toMatchObject({ brandVoice: 'warm and plain', templateId: 7 })
    expect(updateSettings(p, { brandVoice: '', templateId: null }).brandVoice).toBeUndefined()
  })
  it('ignores a template id that is not a positive whole number', () => {
    expect(normalisePlan({ pages: [], templateId: '7' }).templateId).toBeUndefined()
    expect(normalisePlan({ pages: [], templateId: -1 }).templateId).toBeUndefined()
  })
})

describe('site planner: reorder', () => {
  it('moves a page before or after a sibling', () => {
    expect(titles(reorderPage(plan(), 'p4', 'p1', 'before'))).toEqual(['Contact', 'Home', 'About', 'Team'])
    expect(titles(reorderPage(plan(), 'p1', 'p2', 'after'))).toEqual(['About', 'Team', 'Home', 'Contact'])
  })
  it('moves under the target parent when dropped on a page of another level', () => {
    const moved = reorderPage(plan(), 'p4', 'p3', 'before')
    expect(moved.pages.find((p) => p.id === 'p4')?.parentId).toBe('p2')
    expect(titles(moved)).toEqual(['Home', 'About', 'Contact', 'Team'])
  })
  it('never moves a page under its own child', () => {
    const p = plan()
    expect(reorderPage(p, 'p2', 'p3', 'before')).toBe(p)
    expect(reorderPage(p, 'p1', 'p1', 'after')).toBe(p)
  })
  it('shifts up and down among siblings and stops at the ends', () => {
    expect(titles(shiftPage(plan(), 'p2', -1))).toEqual(['About', 'Team', 'Home', 'Contact'])
    expect(titles(shiftPage(plan(), 'p2', 1))).toEqual(['Home', 'Contact', 'About', 'Team'])
    const p = plan()
    expect(shiftPage(p, 'p1', -1)).toBe(p)
    expect(shiftPage(p, 'p4', 1)).toBe(p)
  })
})

describe('site planner: diagram', () => {
  it('puts parents above their children, centred, with one edge per child', () => {
    const d = diagramLayout(plan())
    const at = (id: string) => d.nodes.find((n) => n.id === id)!
    expect(at('p3').y).toBeGreaterThan(at('p2').y)
    expect(at('p2').x).toBe(at('p3').x)
    expect(d.edges).toEqual([{ from: 'p2', to: 'p3' }])
    expect(new Set(d.nodes.filter((n) => n.y === 0).map((n) => n.x)).size).toBe(3)
    expect(d.width).toBeGreaterThan(0)
  })
  it('is empty for an empty plan', () => {
    expect(diagramLayout({ pages: [] })).toMatchObject({ nodes: [], edges: [], height: 0 })
  })
})

describe('site planner: fill this page with AI', () => {
  it('builds the starting brief from the title, brief and sections', () => {
    expect(fillBrief({ title: 'About', brief: 'Who we are.', sections: ['Story', 'Team'] })).toBe('Page: About\n\nWho we are.\n\nSections, in order:\n- Story\n- Team')
    expect(fillBrief({ title: 'Home', brief: '', sections: [] })).toBe('Page: Home')
  })
  it('goes through the pages that exist, in tree order', () => {
    const p = plan()
    expect(fillOrder(p).map((x) => x.pageId)).toEqual([31, 30])
    expect(nextAfter(p, 31)?.pageId).toBe(30)
    expect(nextAfter(p, 30)).toBeNull()
    expect(nextAfter(p, 999)).toBeNull()
  })
})

describe('site planner: section suggestions', () => {
  it('reads the reply and caps the list', () => {
    const ok = parseSections('Sure: {"sections":["Hero","  Services  ",""]}')
    expect(ok).toEqual({ ok: true, sections: ['Hero', 'Services'] })
    const many = parseSections(JSON.stringify({ sections: Array.from({ length: 30 }, (_, i) => `S${i}`) }))
    expect(many.ok && many.sections.length).toBe(12)
  })
  it('refuses a reply with no usable sections', () => {
    expect(parseSections('nothing')).toMatchObject({ ok: false })
    expect(parseSections('{"sections":[]}')).toMatchObject({ ok: false })
    expect(parseSections('{bad')).toMatchObject({ ok: false })
  })
})
