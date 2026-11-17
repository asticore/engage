/**
 * Task 21l: the site planner. A plan is a tree of pages, each with a brief, a list of sections and a status.
 * Pure: no database, no AI call. The AI replies are checked here before anything is kept.
 */

export const PAGE_STATUSES = ['idea', 'briefed', 'drafted', 'done'] as const
export type PageStatus = (typeof PAGE_STATUSES)[number]

export const MAX_PLAN_PAGES = 40
export const MAX_SECTIONS = 12

export type PlanPage = {
  id: string
  title: string
  slug: string
  parentId: string | null
  brief: string
  sections: string[]
  status: PageStatus
  /** The real page created from this entry, once it exists. */
  pageId: number | null
}

export const MAX_BRAND_VOICE = 500

/** `brandVoice` overrides the Build with AI brand voice for this plan; `templateId` is the page template every created draft page starts from. */
export type Plan = { pages: PlanPage[]; brandVoice?: string; templateId?: number | null }

/** The plan-level settings of a plan, to carry over when its pages change. */
const settingsOf = (plan: Plan): Pick<Plan, 'brandVoice' | 'templateId'> => ({ brandVoice: plan.brandVoice, templateId: plan.templateId })

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export const slugOf = (title: string): string =>
  title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

const newId = (n: number): string => `p${n}`

/** Slug that no other page in the plan with the same parent uses. */
export function uniqueSlug(pages: PlanPage[], parentId: string | null, base: string, ignoreId?: string): string {
  const root = base || 'page'
  const taken = new Set(pages.filter((p) => p.parentId === parentId && p.id !== ignoreId).map((p) => p.slug))
  if (!taken.has(root)) return root
  for (let n = 2; n < 100; n++) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`
  return `${root}-${Date.now().toString(36)}`
}

/** Reads a saved or posted plan. Drops broken entries, cycles and orphans, and keeps ids unique. */
export function normalisePlan(raw: unknown): Plan {
  const list = Array.isArray((raw as { pages?: unknown } | null)?.pages) ? ((raw as { pages: unknown[] }).pages) : []
  const seen = new Set<string>()
  const pages: PlanPage[] = []
  for (const item of list.slice(0, MAX_PLAN_PAGES)) {
    const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const id = clean(o.id, 20)
    const title = clean(o.title, 120)
    if (!id || !title || seen.has(id)) continue
    seen.add(id)
    const status = (PAGE_STATUSES as readonly string[]).includes(o.status as string) ? (o.status as PageStatus) : 'idea'
    const sections = (Array.isArray(o.sections) ? o.sections : []).map((s) => clean(s, 80)).filter(Boolean).slice(0, MAX_SECTIONS)
    const pageId = typeof o.pageId === 'number' && Number.isInteger(o.pageId) && o.pageId > 0 ? o.pageId : null
    pages.push({ id, title, slug: slugOf(clean(o.slug, 80)) || slugOf(title), parentId: clean(o.parentId, 20) || null, brief: clean(o.brief, 1200), sections, status, pageId })
  }
  // A parent must exist and must not lead back to the page itself.
  const byId = new Map(pages.map((p) => [p.id, p]))
  for (const p of pages) {
    let cur: PlanPage | undefined = p.parentId ? byId.get(p.parentId) : undefined
    const walked = new Set<string>([p.id])
    while (cur) {
      if (walked.has(cur.id)) { p.parentId = null; break }
      walked.add(cur.id)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    if (p.parentId && !byId.has(p.parentId)) p.parentId = null
  }
  // Slugs are unique among siblings.
  const fixed: PlanPage[] = []
  for (const p of pages) fixed.push({ ...p, slug: uniqueSlug(fixed, p.parentId, p.slug) })
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const brandVoice = clean(root.brandVoice, MAX_BRAND_VOICE)
  const templateId = typeof root.templateId === 'number' && Number.isInteger(root.templateId) && root.templateId > 0 ? root.templateId : null
  return { pages: fixed, ...(brandVoice ? { brandVoice } : {}), ...(templateId ? { templateId } : {}) }
}

/** Reads the AI's page tree reply: JSON with `pages: [{title, parent (a title or empty), brief, sections}]`. */
export function parsePlanReply(reply: string): { ok: true; plan: Plan } | { ok: false; error: string } {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start < 0 || end <= start) return { ok: false, error: 'The reply had no JSON object.' }
  let data: unknown
  try {
    data = JSON.parse(reply.slice(start, end + 1))
  } catch {
    return { ok: false, error: 'The reply was not valid JSON.' }
  }
  const list = Array.isArray((data as { pages?: unknown })?.pages) ? (data as { pages: unknown[] }).pages : []
  if (list.length === 0) return { ok: false, error: 'The reply had no pages.' }
  const entries = list.slice(0, MAX_PLAN_PAGES).map((item, i) => {
    const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return { id: newId(i + 1), title: clean(o.title, 120), parentTitle: clean(o.parent, 120).toLowerCase(), brief: clean(o.brief, 1200), sections: (Array.isArray(o.sections) ? o.sections : []).map((s) => clean(s, 80)).filter(Boolean).slice(0, MAX_SECTIONS) }
  }).filter((e) => e.title)
  if (entries.length === 0) return { ok: false, error: 'No page had a title.' }
  const idByTitle = new Map(entries.map((e) => [e.title.toLowerCase(), e.id]))
  const plan = normalisePlan({
    pages: entries.map((e) => ({
      id: e.id, title: e.title, slug: slugOf(e.title), parentId: e.parentTitle && e.parentTitle !== e.title.toLowerCase() ? idByTitle.get(e.parentTitle) ?? null : null,
      brief: e.brief, sections: e.sections, status: e.brief ? 'briefed' : 'idea',
    })),
  })
  return plan.pages.length > 0 ? { ok: true, plan } : { ok: false, error: 'No usable pages.' }
}

/** Adds the AI's suggested pages to a plan under new ids, skipping titles the plan already has. */
export function mergeSuggestions(plan: Plan, suggested: Plan): Plan {
  const have = new Set(plan.pages.map((p) => p.title.toLowerCase()))
  let n = plan.pages.length
  const idMap = new Map<string, string>()
  const added: PlanPage[] = []
  for (const s of suggested.pages) {
    if (have.has(s.title.toLowerCase()) || plan.pages.length + added.length >= MAX_PLAN_PAGES) continue
    n += 1
    let id = newId(n)
    while (plan.pages.some((p) => p.id === id) || added.some((p) => p.id === id)) id = newId(++n)
    idMap.set(s.id, id)
    added.push({ ...s, id, pageId: null })
  }
  for (const a of added) a.parentId = a.parentId ? idMap.get(a.parentId) ?? plan.pages.find((p) => p.title.toLowerCase() === suggested.pages.find((x) => x.id === a.parentId)?.title.toLowerCase())?.id ?? null : null
  return normalisePlan({ ...settingsOf(plan), pages: [...plan.pages, ...added] })
}

export type TreeNode = PlanPage & { depth: number; path: string }

/** Pages in tree order (parents before children, siblings in plan order) with depth and public path. */
export function treeOrder(plan: Plan): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (parentId: string | null, depth: number, prefix: string) => {
    for (const p of plan.pages.filter((x) => x.parentId === parentId)) {
      const path = `${prefix}/${p.slug}`
      out.push({ ...p, depth, path })
      walk(p.id, depth + 1, path)
    }
  }
  walk(null, 0, '')
  return out
}

export function addPage(plan: Plan, title: string, parentId: string | null): Plan {
  if (plan.pages.length >= MAX_PLAN_PAGES) return plan
  const t = clean(title, 120)
  if (!t) return plan
  let n = plan.pages.length + 1
  while (plan.pages.some((p) => p.id === newId(n))) n++
  const parent = parentId && plan.pages.some((p) => p.id === parentId) ? parentId : null
  return { ...settingsOf(plan), pages: [...plan.pages, { id: newId(n), title: t, slug: uniqueSlug(plan.pages, parent, slugOf(t)), parentId: parent, brief: '', sections: [], status: 'idea', pageId: null }] }
}

/** Removes a page; its children move up to its parent. */
export function removePage(plan: Plan, id: string): Plan {
  const gone = plan.pages.find((p) => p.id === id)
  if (!gone) return plan
  return normalisePlan({ ...settingsOf(plan), pages: plan.pages.filter((p) => p.id !== id).map((p) => (p.parentId === id ? { ...p, parentId: gone.parentId } : p)) })
}

/** Moves a page under another one (or to the top). A page cannot go under itself or its own children. */
export function movePage(plan: Plan, id: string, newParentId: string | null): Plan {
  if (newParentId === id) return plan
  const under = new Set<string>()
  const collect = (pid: string) => { for (const p of plan.pages) if (p.parentId === pid) { under.add(p.id); collect(p.id) } }
  collect(id)
  if (newParentId && under.has(newParentId)) return plan
  return normalisePlan({ ...settingsOf(plan), pages: plan.pages.map((p) => (p.id === id ? { ...p, parentId: newParentId, slug: uniqueSlug(plan.pages, newParentId, p.slug, id) } : p)) })
}

export function updatePage(plan: Plan, id: string, patch: Partial<Pick<PlanPage, 'title' | 'brief' | 'sections' | 'status'>>): Plan {
  return normalisePlan({ ...settingsOf(plan), pages: plan.pages.map((p) => (p.id === id ? { ...p, ...patch, status: patch.status ?? (patch.brief && p.status === 'idea' ? 'briefed' : p.status) } : p)) })
}

/** The next page to fill: the first briefed page in tree order that has no draft yet. */
export const nextToFill = (plan: Plan): PlanPage | null => treeOrder(plan).find((p) => p.status === 'briefed' && p.pageId === null) ?? null

export function progress(plan: Plan): Record<PageStatus, number> & { total: number } {
  const counts = { idea: 0, briefed: 0, drafted: 0, done: 0, total: plan.pages.length }
  for (const p of plan.pages) counts[p.status] += 1
  return counts
}

/** Sets the plan-level brand voice and page template. A blank voice or a null template clears it. */
export function updateSettings(plan: Plan, patch: { brandVoice?: string; templateId?: number | null }): Plan {
  return normalisePlan({ ...plan, ...patch })
}

/**
 * Moves a page next to another one: before or after it, under the same parent. Dragging onto a page under a different parent
 * moves it there too (never under itself or its own children). Page order is the order of `pages`, so siblings keep it.
 */
export function reorderPage(plan: Plan, id: string, targetId: string, where: 'before' | 'after'): Plan {
  if (id === targetId) return plan
  const moving = plan.pages.find((p) => p.id === id)
  const target = plan.pages.find((p) => p.id === targetId)
  if (!moving || !target) return plan
  const under = new Set<string>()
  const collect = (pid: string) => { for (const p of plan.pages) if (p.parentId === pid) { under.add(p.id); collect(p.id) } }
  collect(id)
  if (target.parentId && under.has(target.parentId)) return plan
  if (under.has(target.id)) return plan
  const rest = plan.pages.filter((p) => p.id !== id)
  const at = rest.findIndex((p) => p.id === targetId) + (where === 'after' ? 1 : 0)
  const moved: PlanPage = { ...moving, parentId: target.parentId, slug: uniqueSlug(rest, target.parentId, moving.slug) }
  return normalisePlan({ ...settingsOf(plan), pages: [...rest.slice(0, at), moved, ...rest.slice(at)] })
}

/** Moves a page one place up or down among its siblings. At the end of the list nothing changes. */
export function shiftPage(plan: Plan, id: string, direction: -1 | 1): Plan {
  const page = plan.pages.find((p) => p.id === id)
  if (!page) return plan
  const siblings = plan.pages.filter((p) => p.parentId === page.parentId)
  const i = siblings.findIndex((p) => p.id === id)
  const other = siblings[i + direction]
  return other ? reorderPage(plan, id, other.id, direction === -1 ? 'before' : 'after') : plan
}

export type DiagramNode = { id: string; title: string; status: PageStatus; x: number; y: number }
export type DiagramEdge = { from: string; to: string }
export const DIAGRAM = { nodeWidth: 132, nodeHeight: 40, gapX: 16, gapY: 40 } as const

/** A top-down tree layout of the plan for the diagram: leaves in a row, each parent centred over its children. Pure. */
export function diagramLayout(plan: Plan): { nodes: DiagramNode[]; edges: DiagramEdge[]; width: number; height: number } {
  const { nodeWidth, nodeHeight, gapX, gapY } = DIAGRAM
  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  let leaf = 0
  let maxDepth = 0
  const place = (parentId: string | null, depth: number): number[] => {
    const xs: number[] = []
    for (const p of plan.pages.filter((x) => x.parentId === parentId)) {
      maxDepth = Math.max(maxDepth, depth)
      const childXs = place(p.id, depth + 1)
      const x = childXs.length ? (childXs[0] + childXs[childXs.length - 1]) / 2 : leaf++ * (nodeWidth + gapX)
      nodes.push({ id: p.id, title: p.title, status: p.status, x, y: depth * (nodeHeight + gapY) })
      for (const c of plan.pages.filter((y) => y.parentId === p.id)) edges.push({ from: p.id, to: c.id })
      xs.push(x)
    }
    return xs
  }
  place(null, 0)
  return { nodes, edges, width: Math.max(leaf, 1) * (nodeWidth + gapX), height: nodes.length ? (maxDepth + 1) * (nodeHeight + gapY) - gapY : 0 }
}

/** The pages that have a real page, in tree order: the order "Fill this page with AI" goes through them. */
export const fillOrder = (plan: Plan): PlanPage[] => treeOrder(plan).filter((p) => p.pageId !== null)

/** The page to fill after this one, or null at the end. */
export function nextAfter(plan: Plan, pageId: number): PlanPage | null {
  const order = fillOrder(plan)
  const i = order.findIndex((p) => p.pageId === pageId)
  return i >= 0 ? order[i + 1] ?? null : null
}

/** The brief text the AI page builder starts with for one planned page: the brief, then the section list. */
export function fillBrief(page: Pick<PlanPage, 'title' | 'brief' | 'sections'>): string {
  const lines = [`Page: ${page.title}`]
  if (page.brief) lines.push(page.brief)
  if (page.sections.length) lines.push(`Sections, in order:\n${page.sections.map((s) => `- ${s}`).join('\n')}`)
  return lines.join('\n\n')
}
