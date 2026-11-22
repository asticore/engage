// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { briefText } from '@/features/blogBuilder/prompts'
import { parseBrief } from '@/features/blogBuilder/request'
import {
  DEFAULT_QUESTION_SET,
  MAX_QUESTION_SETS,
  moveQuestion,
  parseQuestions,
  pickDefaultSet,
  removeQuestionSet,
  saveQuestionSet,
  type BlogQuestionSet,
  type BuiltInKey,
} from '@/features/blogBuilder/questionSets'

const q = (id: string, key: BuiltInKey | null, extra: Record<string, unknown> = {}) => ({ id, key, label: key ? '' : 'Your story', hint: '', required: false, ...extra })
const set = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  postType: '',
  isDefault: false,
  questions: [q('a1', 'topic'), q('a2', null)],
  ...extra,
})

describe('blog builder question sets', () => {
  it('keeps the topic question and forces it to be required', () => {
    const ok = parseQuestions([q('a1', 'topic', { required: false })])
    expect(ok.ok && ok.value[0]!.required).toBe(true)
    expect(parseQuestions([q('a1', 'audience')]).ok).toBe(false)
  })

  it('refuses duplicate standard questions, empty custom text, and too many custom questions', () => {
    expect(parseQuestions([q('a1', 'topic'), q('a2', 'topic')]).ok).toBe(false)
    expect(parseQuestions([q('a1', 'topic'), q('a2', null, { label: '' })]).ok).toBe(false)
    const many = [q('t', 'topic'), ...Array.from({ length: 9 }, (_, i) => q(`c${i}`, null))]
    expect(parseQuestions(many).ok).toBe(false)
  })

  it('adds, replaces, and refuses a duplicate name or a full list', () => {
    const added = saveQuestionSet([], set('s1', 'News'))
    expect(added.ok).toBe(true)
    const list = added.ok ? added.value : []
    expect(saveQuestionSet(list, set('s2', 'news')).ok).toBe(false)
    const renamed = saveQuestionSet(list, set('s1', 'News and notes'))
    expect(renamed.ok && renamed.value.map((s) => s.name)).toEqual(['News and notes'])
    const full: BlogQuestionSet[] = Array.from({ length: MAX_QUESTION_SETS }, (_, i) => set(`s${i}`, `Set ${i}`) as BlogQuestionSet)
    expect(saveQuestionSet(full, set('new', 'One more')).ok).toBe(false)
  })

  it('keeps one default set', () => {
    const a = saveQuestionSet([], set('s1', 'A', { isDefault: true }))
    const b = a.ok ? saveQuestionSet(a.value, set('s2', 'B', { isDefault: true })) : a
    expect(b.ok && b.value.filter((s) => s.isDefault).map((s) => s.id)).toEqual(['s2'])
  })

  it('offers the built-in default when none are saved, and picks the default set', () => {
    expect(pickDefaultSet([]).id).toBe(DEFAULT_QUESTION_SET.id)
    const a = saveQuestionSet([], set('s1', 'A'))
    const b = a.ok ? saveQuestionSet(a.value, set('s2', 'B', { isDefault: true })) : a
    expect(b.ok && pickDefaultSet(b.value).id).toBe('s2')
    expect(removeQuestionSet(b.ok ? b.value : [], 's2').map((s) => s.id)).toEqual(['s1'])
  })

  it('moves questions and ignores out of range moves', () => {
    const list = [q('a', 'topic'), q('b', 'audience'), q('c', 'tone')]
    expect(moveQuestion(list, 2, -1).map((x) => x.id)).toEqual(['a', 'c', 'b'])
    expect(moveQuestion(list, 0, -1)).toBe(list)
  })

  it('carries custom answers into the brief and the prompt, dropping empty ones', () => {
    const brief = parseBrief({ topic: 'Spring menu', extras: [{ question: 'Your story', answer: 'We started in 1999' }, { question: 'Empty', answer: '' }] })
    expect(brief.ok && brief.value.extras).toEqual([{ question: 'Your story', answer: 'We started in 1999' }])
    expect(brief.ok && briefText(brief.value)).toContain('Your story: We started in 1999')
    const plain = parseBrief({ topic: 'Spring menu' })
    expect(plain.ok && plain.value.extras).toBeUndefined()
  })
})
