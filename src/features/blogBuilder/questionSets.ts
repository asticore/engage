/**
 * Editable question sets for the blog builder (Task 8, 27b). A set is a named, ordered list of questions the
 * wizard asks before it writes. Pure: parsing, limits and the add, update and remove rules. Stored in the
 * small table `eg_blog_question_sets` (see `questionSetStore.ts`).
 *
 * Six built-in questions map to the brief fields (topic, audience, tone, length, keywords, call to action).
 * Custom questions are free text; their answers reach the prompts as extra notes. The topic question can be
 * reordered and reworded but never removed or made optional, because the brief needs a topic.
 */

export const BUILT_IN_KEYS = ['topic', 'audience', 'tone', 'length', 'keywords', 'callToAction'] as const
export type BuiltInKey = (typeof BUILT_IN_KEYS)[number]

export type BlogQuestion = {
  id: string
  /** Which brief field this question fills, or null for a custom free-text question. */
  key: BuiltInKey | null
  /** Text shown to the admin. Empty on a built-in question means the translated default. */
  label: string
  hint: string
  required: boolean
}

export type BlogQuestionSet = {
  id: string
  name: string
  /** Post type or brand this set is for. Empty means any. */
  postType: string
  isDefault: boolean
  questions: BlogQuestion[]
}

export type SetResult<T> = { ok: true; value: T } | { ok: false; error: string }

export const MAX_QUESTION_SETS = 20
export const MAX_QUESTIONS = 15
export const MAX_CUSTOM_QUESTIONS = 8
export const SET_NAME_MAX = 60
export const POST_TYPE_MAX = 40
export const LABEL_MAX = 120
export const HINT_MAX = 200

const ID_RE = /^[A-Za-z0-9-]{1,64}$/

/** The set shown until an admin saves their own. Never stored, so "reset" is simply deleting stored sets. */
export const DEFAULT_QUESTION_SET: BlogQuestionSet = {
  id: 'default',
  name: '',
  postType: '',
  isDefault: true,
  questions: [
    { id: 'q-topic', key: 'topic', label: '', hint: '', required: true },
    { id: 'q-audience', key: 'audience', label: '', hint: '', required: false },
    { id: 'q-tone', key: 'tone', label: '', hint: '', required: false },
    { id: 'q-length', key: 'length', label: '', hint: '', required: false },
    { id: 'q-keywords', key: 'keywords', label: '', hint: '', required: false },
    { id: 'q-callToAction', key: 'callToAction', label: '', hint: '', required: false },
  ],
}

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return value === undefined || value === null ? '' : null
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length <= max ? trimmed : null
}

/** Checks one question list. Returns a clean copy or the first problem found, in plain words. */
export function parseQuestions(raw: unknown): SetResult<BlogQuestion[]> {
  if (!Array.isArray(raw) || raw.length < 1) return { ok: false, error: 'A question set needs at least one question.' }
  if (raw.length > MAX_QUESTIONS) return { ok: false, error: `A question set can have up to ${MAX_QUESTIONS} questions.` }
  const out: BlogQuestion[] = []
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()
  let custom = 0
  for (const item of raw) {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const id = typeof row.id === 'string' && ID_RE.test(row.id) ? row.id : null
    if (!id || seenIds.has(id)) return { ok: false, error: 'A question could not be read. Reload and try again.' }
    seenIds.add(id)
    const key = row.key === null || row.key === undefined ? null : (BUILT_IN_KEYS as readonly string[]).includes(row.key as string) ? (row.key as BuiltInKey) : undefined
    if (key === undefined) return { ok: false, error: 'A question could not be read. Reload and try again.' }
    if (key) {
      if (seenKeys.has(key)) return { ok: false, error: 'Each built-in question can be used once.' }
      seenKeys.add(key)
    } else custom += 1
    const label = clean(row.label, LABEL_MAX)
    const hint = clean(row.hint, HINT_MAX)
    if (label === null) return { ok: false, error: `A question can be up to ${LABEL_MAX} characters.` }
    if (hint === null) return { ok: false, error: `A hint can be up to ${HINT_MAX} characters.` }
    if (!key && !label) return { ok: false, error: 'Write the question text for each custom question.' }
    out.push({ id, key, label, hint, required: key === 'topic' ? true : row.required === true })
  }
  if (custom > MAX_CUSTOM_QUESTIONS) return { ok: false, error: `You can add up to ${MAX_CUSTOM_QUESTIONS} custom questions.` }
  if (!seenKeys.has('topic')) return { ok: false, error: 'Keep the topic question: the post needs a topic.' }
  return { ok: true, value: out }
}

/** Reads one stored or posted set. Anything that does not check out is refused, never repaired. */
export function parseQuestionSet(raw: unknown): SetResult<BlogQuestionSet> {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const id = typeof row.id === 'string' && ID_RE.test(row.id) ? row.id : null
  if (!id) return { ok: false, error: 'The set could not be saved. Try again.' }
  const name = clean(row.name, SET_NAME_MAX)
  if (!name) return { ok: false, error: name === null ? `The name can be up to ${SET_NAME_MAX} characters.` : 'Give the set a name.' }
  const postType = clean(row.postType, POST_TYPE_MAX)
  if (postType === null) return { ok: false, error: `The post type can be up to ${POST_TYPE_MAX} characters.` }
  const questions = parseQuestions(row.questions)
  if (questions.ok === false) return questions
  return { ok: true, value: { id, name, postType, isDefault: row.isDefault === true, questions: questions.value } }
}

/**
 * Saves one set into the list: adds it, or replaces the one with the same id. Names must be unique. At most one
 * set is the default: marking this one clears the flag on the others.
 */
export function saveQuestionSet(list: BlogQuestionSet[], raw: unknown): SetResult<BlogQuestionSet[]> {
  const parsed = parseQuestionSet(raw)
  if (parsed.ok === false) return parsed
  const next = parsed.value
  if (list.some((set) => set.id !== next.id && set.name.toLowerCase() === next.name.toLowerCase())) {
    return { ok: false, error: 'Another set already has this name.' }
  }
  const exists = list.some((set) => set.id === next.id)
  if (!exists && list.length >= MAX_QUESTION_SETS) {
    return { ok: false, error: `You can save up to ${MAX_QUESTION_SETS} sets. Delete one first.` }
  }
  const others = list.filter((set) => set.id !== next.id).map((set) => (next.isDefault ? { ...set, isDefault: false } : set))
  const merged = exists ? list.map((set) => (set.id === next.id ? next : next.isDefault ? { ...set, isDefault: false } : set)) : [...others, next]
  return { ok: true, value: merged }
}

export function removeQuestionSet(list: BlogQuestionSet[], id: string): BlogQuestionSet[] {
  return list.filter((set) => set.id !== id)
}

/** The sets the wizard offers: the saved ones, or the built-in default when none are saved. */
export function offeredSets(list: BlogQuestionSet[]): BlogQuestionSet[] {
  return list.length ? list : [DEFAULT_QUESTION_SET]
}

/** The set to preselect: the one marked default, else the first. */
export function pickDefaultSet(list: BlogQuestionSet[]): BlogQuestionSet {
  const sets = offeredSets(list)
  return sets.find((set) => set.isDefault) ?? sets[0]!
}

/** Moves one question up (-1) or down (1). Out of range is a no-op. */
export function moveQuestion(questions: BlogQuestion[], index: number, delta: -1 | 1): BlogQuestion[] {
  const to = index + delta
  if (index < 0 || index >= questions.length || to < 0 || to >= questions.length) return questions
  const next = questions.slice()
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item!)
  return next
}
