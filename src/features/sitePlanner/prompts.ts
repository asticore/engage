import { MAX_PLAN_PAGES, MAX_SECTIONS, type Plan, type PlanPage } from './plan'

/** Prompts for the site planner. The AI only returns text: nothing it says is saved until the person reviews it. */

const JSON_SHAPE = `Reply with JSON only, no other text, in this shape:
{"pages":[{"title":"Home","parent":"","brief":"What this page is for and who reads it, in one or two sentences.","sections":["Hero with a clear headline","Services overview","Testimonials","Contact call to action"]}]}
"parent" is the exact title of another page in the list, or an empty string for a top-level page. Use at most ${MAX_PLAN_PAGES} pages and at most 8 sections per page. Plain text only, no markdown.`

export const plannerSystem = (siteName: string, brandVoice: string): string =>
  `You plan the pages of a small business website. ${siteName ? `The site is called ${siteName}. ` : ''}${brandVoice ? `Brand voice: ${brandVoice} ` : ''}Be practical: only pages a real visitor needs. Never invent facts, prices, awards or customer names.`

export const questionsPrompt = (idea: string): string =>
  `A person wants a website. Their description:\n"""${idea.slice(0, 1500)}"""\n\nAsk the 5 to 7 most useful questions you need answered before planning the pages (audience, services or products, goals, tone, must-have pages, whether they sell online, local or national). Reply with JSON only: {"questions":["...","..."]}. Each question is one short sentence.`

export const planPrompt = (idea: string, answers: string): string =>
  `Plan the pages of this website.\n\nDescription:\n"""${idea.slice(0, 1500)}"""\n\nAnswers to the follow-up questions:\n"""${answers.slice(0, 3000)}"""\n\n${JSON_SHAPE}`

export const suggestPrompt = (plan: Plan, idea: string): string =>
  `Here is the current page plan for a website (${idea.slice(0, 500)}):\n${plan.pages.map((p) => `- ${p.title}${p.parentId ? ` (under ${plan.pages.find((x) => x.id === p.parentId)?.title ?? ''})` : ''}`).join('\n')}\n\nSuggest up to 6 extra pages that are missing and would help visitors or search engines. Do not repeat existing pages. ${JSON_SHAPE}`

/** Reads the interview reply. */
export function parseQuestions(reply: string): { ok: true; questions: string[] } | { ok: false; error: string } {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start < 0 || end <= start) return { ok: false, error: 'The reply had no JSON object.' }
  try {
    const list = (JSON.parse(reply.slice(start, end + 1)) as { questions?: unknown }).questions
    const questions = (Array.isArray(list) ? list : []).map((q) => (typeof q === 'string' ? q.trim().slice(0, 300) : '')).filter(Boolean).slice(0, 8)
    return questions.length ? { ok: true, questions } : { ok: false, error: 'The reply had no questions.' }
  } catch {
    return { ok: false, error: 'The reply was not valid JSON.' }
  }
}

export const sectionsPrompt = (page: Pick<PlanPage, 'title' | 'brief'>, plan: Plan, idea: string): string =>
  `A website is being planned (${idea.slice(0, 500) || 'no description given'}). Its pages: ${plan.pages.map((p) => p.title).join(', ')}.\n\nSuggest the sections for the page "${page.title}"${page.brief ? `, whose brief is: ${page.brief}` : ''}. Order them as a visitor would read the page, top to bottom. Use at most ${MAX_SECTIONS} sections, each a short plain phrase such as "Hero with a clear headline". Reply with JSON only: {"sections":["...","..."]}.`

/** Reads the section suggestion reply. */
export function parseSections(reply: string): { ok: true; sections: string[] } | { ok: false; error: string } {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start < 0 || end <= start) return { ok: false, error: 'The reply had no JSON object.' }
  try {
    const list = (JSON.parse(reply.slice(start, end + 1)) as { sections?: unknown }).sections
    const sections = (Array.isArray(list) ? list : []).map((v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 80) : '')).filter(Boolean).slice(0, MAX_SECTIONS)
    return sections.length ? { ok: true, sections } : { ok: false, error: 'The reply had no sections.' }
  } catch {
    return { ok: false, error: 'The reply was not valid JSON.' }
  }
}
