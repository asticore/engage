/**
 * Task 21a: A/B test ideas from the page itself. Pure: reads the section tree the visual editor holds and proposes a few
 * tests, each with a plain reason and the kind of effect to expect. It does not claim numbers it cannot know.
 */
import type { SectionNode } from '@/lib/sectionTree'

export type IdeaKind = 'headline' | 'button' | 'image' | 'layout'
export type AbIdea = {
  /** Stable for the same section and kind. */
  id: string
  kind: IdeaKind
  /** The section the test would replace (the engine block id), or null when the section has not been saved yet. */
  sectionId: string | null
  /** Index of the section in the page, for selecting it. */
  sectionIndex: number
  title: string
  reason: string
  impact: string
}

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' ? (v as Rec) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Labels that say nothing about what the visitor gets. */
const GENERIC_LABEL = /^(submit|send|click here|learn more|read more|more|go|continue|next|ok)$/i

function walk(node: SectionNode, visit: (n: SectionNode) => void): void {
  visit(node)
  node.columns?.forEach((c) => (c.blocks || []).forEach((b) => walk(b, visit)))
}

type Found = { headings: string[]; buttons: string[]; images: number; blocks: number; columns: number; bgImage: boolean }
function scan(section: SectionNode): Found {
  const f: Found = { headings: [], buttons: [], images: 0, blocks: 0, columns: section.columns?.length ?? 0, bgImage: false }
  walk(section, (n) => {
    f.blocks += 1
    const props = rec(n.props)
    const design = rec(n.design)
    if (design.bgType === 'image' || design.bgType === 'video' || design.bgType === 'slideshow') f.bgImage = true
    if (n.blockType === 'element') {
      const type = str(n.elementType)
      if (type === 'heading' && str(props.text)) f.headings.push(str(props.text))
      if (type === 'image') f.images += 1
      if (/button|cta/i.test(type)) {
        const label = str(props.text) || str(props.label)
        if (label) f.buttons.push(label)
      }
    } else {
      for (const [key, value] of Object.entries(n as Rec)) {
        if (!str(value)) continue
        if (key === 'buttonText' || /^.*CtaLabel$/.test(key) || /^.*Label$/.test(key) && /cta|button/i.test(key)) f.buttons.push(str(value))
        if (key === 'headline' || key === 'heading' || key === 'title') f.headings.push(str(value))
      }
    }
  })
  return f
}

/** Up to `limit` ideas, best first: a headline test on the first section, then button text, hero image, layout. */
export function suggestTests(tree: SectionNode[], limit = 5): AbIdea[] {
  const ideas: AbIdea[] = []
  tree.forEach((section, index) => {
    const f = scan(section)
    const sectionId = section.id !== undefined && section.id !== null && String(section.id) ? String(section.id) : null
    const idea = (kind: IdeaKind, title: string, reason: string, impact: string) => ideas.push({ id: `${kind}:${sectionId ?? `i${index}`}`, kind, sectionId, sectionIndex: index, title, reason, impact })
    if (f.headings.length > 0 && index <= 1) {
      const h = f.headings[0]
      idea('headline', `Test a second headline for “${h.slice(0, 60)}”`, index === 0 ? 'The first headline is the first thing every visitor reads, so most of them see it.' : 'This headline is near the top of the page, where most visitors still are.', 'Headlines usually move clicks more than any other single change; the size depends on your traffic.')
    }
    const generic = f.buttons.find((b) => GENERIC_LABEL.test(b))
    if (generic) idea('button', `Test a clearer label than “${generic}”`, 'The label does not say what the visitor gets.', 'A label that names the outcome (for example “Get my quote”) often lifts clicks a little; a small test needs a few hundred visitors.')
    else if (f.buttons.length > 0 && index === 0) idea('button', `Test the button text “${f.buttons[0].slice(0, 40)}”`, 'It is the main action in the first section.', 'Button text is cheap to change and quick to read out.')
    if ((f.images > 0 || f.bgImage) && index === 0) idea('image', 'Test a different top picture', 'The top picture sets the first impression and loads before anything else.', 'A people or product picture against a plain one can change how long visitors stay; it needs more traffic than a text test to show.')
    if (f.columns >= 3 || f.blocks >= 8) idea('layout', 'Test a simpler layout for this section', `It holds ${f.blocks} items${f.columns >= 3 ? ` in ${f.columns} columns` : ''}, which can bury the main action.`, 'Layout tests are the slowest to read out; run one only with steady traffic.')
  })
  const order: Record<IdeaKind, number> = { headline: 0, button: 1, image: 2, layout: 3 }
  return ideas.sort((a, b) => order[a.kind] - order[b.kind] || a.sectionIndex - b.sectionIndex).slice(0, limit)
}

export type GoalChoice =
  | { id: string; label: string; goal: { type: 'element-clicked'; selector: string } }
  | { id: string; label: string; goal: { type: 'page-visited'; path: string } }
  | { id: string; label: string; goal: { type: 'form-submitted'; formId: string | null } }

const refId = (v: unknown): string => {
  if (typeof v === 'number' || typeof v === 'string') return String(v)
  if (v && typeof v === 'object' && 'id' in v) return String((v as { id: unknown }).id)
  return ''
}

/**
 * What can count as a win, from the page's own content: each button with a link (clicked, and, for an internal link,
 * visited) and each form block. The visitor of the editor picks one instead of typing a selector or a path.
 */
export function goalChoices(tree: SectionNode[]): GoalChoice[] {
  const out: GoalChoice[] = []
  const seen = new Set<string>()
  const add = (c: GoalChoice) => {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      out.push(c)
    }
  }
  const visit = (n: SectionNode) => {
    const props = rec(n.props)
    if (n.blockType === 'element' && /button|cta/i.test(str(n.elementType))) {
      const url = str(props.url) || str(props.link)
      const label = str(props.text) || str(props.label) || url
      if (/^(\/|https?:\/\/)[^"\\\s]*$/.test(url)) {
        add({ id: `click:${url}`, label: `“${label.slice(0, 50)}” button is clicked (${url.slice(0, 60)})`, goal: { type: 'element-clicked', selector: `a[href="${url}"]` } })
        if (url.startsWith('/') && !url.startsWith('//')) add({ id: `visit:${url.split(/[?#]/)[0]}`, label: `The page ${url.split(/[?#]/)[0]} is visited`, goal: { type: 'page-visited', path: url.split(/[?#]/)[0] } })
      }
    }
    if (n.blockType === 'form') {
      const id = refId((n as Rec).form)
      add({ id: `form:${id || 'any'}`, label: id ? `The form on this page (#${id}) is submitted` : 'A form on this page is submitted', goal: { type: 'form-submitted', formId: id || null } })
    }
    n.columns?.forEach((c) => (c.blocks || []).forEach(visit))
  }
  tree.forEach(visit)
  return out
}

export type PastTest = {
  name: string
  status: string
  outcome: { winner: string | null; leader: string | null; uplift: number | null; readiness: string; visitors: number } | null
}
export type ResultIdea = { id: string; title: string; reason: string; impact: string }

const pct = (v: number | null): string => (v === null || !Number.isFinite(v) ? '' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`)

/**
 * Ideas from this page's finished tests: a test that found a winner points at the next thing to try; one that did not
 * reach a clear answer says what would help. Pure. Only stopped tests count, and a test with no data gives no idea.
 */
export function resultIdeas(past: PastTest[], limit = 3): ResultIdea[] {
  const ideas: ResultIdea[] = []
  for (const t of past) {
    if (t.status !== 'stopped' || !t.outcome || t.outcome.visitors === 0) continue
    const o = t.outcome
    if (o.readiness === 'significant' && o.winner && !/^original$/i.test(o.winner)) {
      ideas.push({ id: `won:${t.name}`, title: `Build on “${t.name}”`, reason: `${o.winner} won${pct(o.uplift) ? ` (${pct(o.uplift)})` : ''} from ${o.visitors} visitors.`, impact: 'Keep the winner, then test the next thing on the page, such as the button label or the top picture, so the gains add up.' })
    } else if (o.readiness === 'significant') {
      ideas.push({ id: `kept:${t.name}`, title: `The original held up in “${t.name}”`, reason: `No variant beat the original after ${o.visitors} visitors.`, impact: 'Try a bolder change next time: a different promise or layout, not a small wording tweak.' })
    } else {
      ideas.push({ id: `open:${t.name}`, title: `Run “${t.name}” again with a bigger change`, reason: `It stopped without a clear result after ${o.visitors} visitors${o.leader ? ` (${o.leader} was ahead${pct(o.uplift) ? ` by ${pct(o.uplift)}` : ''}, but that could be chance)` : ''}.`, impact: 'Tests of small changes need many visitors. A bolder variant, or a longer run, gives a clearer answer.' })
    }
  }
  return ideas.slice(0, limit)
}
