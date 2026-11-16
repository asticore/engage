import { describe, expect, it } from 'vitest'

import { addPage, mergeSuggestions, movePage, nextToFill, normalisePlan, parsePlanReply, progress, removePage, treeOrder, updatePage } from '@/features/sitePlanner/plan'
import { parseQuestions } from '@/features/sitePlanner/prompts'

const reply = JSON.stringify({ pages: [
  { title: 'Home', parent: '', brief: 'Front door.', sections: ['Hero', 'Services'] },
  { title: 'Services', parent: 'Home', brief: 'What we do.', sections: ['List'] },
  { title: 'Web design', parent: 'Services', brief: '', sections: [] },
  { title: 'About', parent: 'Nobody', brief: 'Who we are.', sections: [] },
] })

describe('site planner', () => {
  it('reads an AI reply into a tree and ignores unknown parents', () => {
    const r = parsePlanReply(`Here you go:\n${reply}`)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const order = treeOrder(r.plan)
    expect(order.map((p) => `${p.depth}:${p.path}`)).toEqual(['0:/home', '1:/home/services', '2:/home/services/web-design', '0:/about'])
    expect(r.plan.pages.find((p) => p.title === 'Web design')?.status).toBe('idea')
    expect(r.plan.pages.find((p) => p.title === 'About')?.parentId).toBeNull()
  })
  it('refuses replies that are not usable', () => {
    expect(parsePlanReply('no json').ok).toBe(false)
    expect(parsePlanReply('{"pages":[]}').ok).toBe(false)
    expect(parsePlanReply('{bad').ok).toBe(false)
    expect(parseQuestions('{"questions":["Who is it for?","What do you sell?"]}')).toEqual({ ok: true, questions: ['Who is it for?', 'What do you sell?'] })
    expect(parseQuestions('{"questions":[]}').ok).toBe(false)
  })
  it('edits the tree: add, move, remove, no loops, unique slugs', () => {
    let plan = normalisePlan({ pages: [] })
    plan = addPage(plan, 'Home', null)
    plan = addPage(plan, 'Blog', null)
    plan = addPage(plan, 'Blog', null)
    expect(plan.pages.map((p) => p.slug)).toEqual(['home', 'blog', 'blog-2'])
    plan = movePage(plan, 'p3', 'p2')
    expect(treeOrder(plan).map((p) => p.path)).toEqual(['/home', '/blog', '/blog/blog-2'])
    expect(movePage(plan, 'p2', 'p3')).toEqual(plan)
    plan = removePage(plan, 'p2')
    expect(treeOrder(plan).map((p) => p.path)).toEqual(['/home', '/blog-2'])
  })
  it('breaks parent cycles and drops duplicates when reading a saved plan', () => {
    const plan = normalisePlan({ pages: [
      { id: 'a', title: 'A', parentId: 'b' }, { id: 'b', title: 'B', parentId: 'a' }, { id: 'a', title: 'Dup' }, { id: 'c', title: 'C', parentId: 'zzz' },
    ] })
    expect(plan.pages.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(plan.pages.every((p) => p.parentId === null || p.parentId === 'a' || p.parentId === 'b')).toBe(true)
    expect(plan.pages.find((p) => p.id === 'c')?.parentId).toBeNull()
    expect(treeOrder(plan)).toHaveLength(3)
  })
  it('merges suggestions without repeating titles', () => {
    const base = normalisePlan({ pages: [{ id: 'p1', title: 'Home' }] })
    const s = parsePlanReply(JSON.stringify({ pages: [{ title: 'home', parent: '' }, { title: 'FAQ', parent: 'Home', brief: 'Answers.' }] }))
    expect(s.ok).toBe(true)
    if (!s.ok) return
    const merged = mergeSuggestions(base, s.plan)
    expect(merged.pages.map((p) => p.title)).toEqual(['Home', 'FAQ'])
    expect(merged.pages[1].parentId).toBe('p1')
  })
  it('tracks status and the next page to fill', () => {
    let plan = parsePlanReply(reply).ok ? (parsePlanReply(reply) as { ok: true; plan: ReturnType<typeof normalisePlan> }).plan : normalisePlan({})
    expect(nextToFill(plan)?.title).toBe('Home')
    plan = updatePage(plan, 'p1', { status: 'drafted' })
    expect(nextToFill(plan)?.title).toBe('Services')
    plan = updatePage(plan, 'p3', { brief: 'Design websites.' })
    expect(plan.pages.find((p) => p.id === 'p3')?.status).toBe('briefed')
    expect(progress(plan)).toMatchObject({ total: 4, drafted: 1 })
  })
})
