'use client'

import { useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import type { UiStringKey } from '@/features/uiStrings'
import {
  BUILT_IN_KEYS,
  DEFAULT_QUESTION_SET,
  MAX_CUSTOM_QUESTIONS,
  MAX_QUESTIONS,
  moveQuestion,
  offeredSets,
  type BlogQuestion,
  type BlogQuestionSet,
  type BuiltInKey,
} from '../questionSets'

import { postQuestionSet } from './api'

/** The default wording of each standard question, translated. */
export const QUESTION_LABEL_KEY: Record<BuiltInKey, UiStringKey> = {
  topic: 'blog.ai.topic',
  audience: 'blog.ai.audience',
  tone: 'blog.ai.tone',
  length: 'blog.ai.length',
  keywords: 'blog.ai.keywords',
  callToAction: 'blog.ai.cta',
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

type Props = {
  sets: BlogQuestionSet[]
  onSets: (sets: BlogQuestionSet[]) => void
  onClose: () => void
}

/** Admin editor for the question sets: add, remove, reword, reorder, required, per post type or brand. */
export function QuestionSetEditor({ sets, onSets, onClose }: Props) {
  const t = useAdminT()
  const choices = offeredSets(sets)
  const [draft, setDraft] = useState<BlogQuestionSet>(() => seed(choices[0]!))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved = sets.some((set) => set.id === draft.id)

  function seed(set: BlogQuestionSet): BlogQuestionSet {
    // The built-in default has no stored id: editing it starts a new saved set.
    return set.id === DEFAULT_QUESTION_SET.id ? { ...set, id: newId(), name: '', questions: set.questions.map((q) => ({ ...q })) } : { ...set, questions: set.questions.map((q) => ({ ...q })) }
  }

  const setQuestion = (index: number, patch: Partial<BlogQuestion>) =>
    setDraft((current) => ({ ...current, questions: current.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) }))

  const missing = BUILT_IN_KEYS.filter((key) => !draft.questions.some((q) => q.key === key))
  const customCount = draft.questions.filter((q) => !q.key).length

  const run = async (body: Parameters<typeof postQuestionSet>[0], after?: (list: BlogQuestionSet[]) => void) => {
    setBusy(true)
    setError(null)
    try {
      const list = await postQuestionSet(body)
      onSets(list)
      after?.(list)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('blog.ai.qe.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="blog-ai__form" aria-label={t('blog.ai.qe.title')}>
      <h3>{t('blog.ai.qe.title')}</h3>
      {error ? (
        <p role="alert" className="blog-ai__error">
          {error}
        </p>
      ) : null}
      <label className="blog-ai__field">
        <span>{t('blog.ai.questionSet')}</span>
        <select
          value={saved ? draft.id : ''}
          onChange={(e) => {
            const next = choices.find((set) => set.id === e.target.value)
            setDraft(next ? seed(next) : { id: newId(), name: '', postType: '', isDefault: false, questions: DEFAULT_QUESTION_SET.questions.map((q) => ({ ...q })) })
          }}
        >
          {saved ? null : <option value="">{t('blog.ai.qe.newSet')}</option>}
          {sets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
        </select>
      </label>
      <div className="blog-ai__row">
        <label className="blog-ai__field">
          <span>{t('blog.ai.qe.setName')}</span>
          <input type="text" maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="blog-ai__field">
          <span>{t('blog.ai.qe.postType')}</span>
          <input type="text" maxLength={40} value={draft.postType} onChange={(e) => setDraft({ ...draft, postType: e.target.value })} />
        </label>
      </div>
      <label className="blog-ai__choice">
        <input type="checkbox" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} />
        <span>{t('blog.ai.qe.makeDefault')}</span>
      </label>
      <ol className="blog-ai__outline">
        {draft.questions.map((question, index) => (
          <li key={question.id} className="blog-ai__outline-row">
            <label className="blog-ai__field">
              <span>{t('blog.ai.qe.questionText')}</span>
              <input
                type="text"
                maxLength={120}
                value={question.label}
                placeholder={question.key ? t(QUESTION_LABEL_KEY[question.key]) : ''}
                onChange={(e) => setQuestion(index, { label: e.target.value })}
              />
            </label>
            <label className="blog-ai__field">
              <span>{t('blog.ai.qe.hint')}</span>
              <input type="text" maxLength={200} value={question.hint} onChange={(e) => setQuestion(index, { hint: e.target.value })} />
            </label>
            <label className="blog-ai__choice">
              <input
                type="checkbox"
                checked={question.required}
                disabled={question.key === 'topic'}
                onChange={(e) => setQuestion(index, { required: e.target.checked })}
              />
              <span>{t('blog.ai.qe.required')}</span>
            </label>
            <div className="blog-ai__row">
              <button type="button" className="btn" disabled={index === 0} onClick={() => setDraft({ ...draft, questions: moveQuestion(draft.questions, index, -1) })}>
                {t('blog.ai.qe.up')}
              </button>
              <button
                type="button"
                className="btn"
                disabled={index === draft.questions.length - 1}
                onClick={() => setDraft({ ...draft, questions: moveQuestion(draft.questions, index, 1) })}
              >
                {t('blog.ai.qe.down')}
              </button>
              <button
                type="button"
                className="btn"
                disabled={question.key === 'topic'}
                onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, i) => i !== index) })}
              >
                {t('blog.ai.qe.remove')}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="blog-ai__row">
        <button
          type="button"
          className="btn"
          disabled={customCount >= MAX_CUSTOM_QUESTIONS || draft.questions.length >= MAX_QUESTIONS}
          onClick={() => setDraft({ ...draft, questions: [...draft.questions, { id: newId(), key: null, label: '', hint: '', required: false }] })}
        >
          {t('blog.ai.qe.addCustom')}
        </button>
        {missing.length > 0 ? (
          <label className="blog-ai__field">
            <span>{t('blog.ai.qe.addStandard')}</span>
            <select
              value=""
              disabled={draft.questions.length >= MAX_QUESTIONS}
              onChange={(e) => {
                const key = e.target.value as BuiltInKey
                if (key) setDraft({ ...draft, questions: [...draft.questions, { id: newId(), key, label: '', hint: '', required: false }] })
              }}
            >
              <option value="" />
              {missing.map((key) => (
                <option key={key} value={key}>
                  {t(QUESTION_LABEL_KEY[key])}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="blog-ai__row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || !draft.name.trim()}
          onClick={() => void run({ action: 'save', set: draft })}
        >
          {t('blog.ai.qe.save')}
        </button>
        <button type="button" className="btn" disabled={busy || !saved} onClick={() => void run({ action: 'delete', id: draft.id }, (list) => setDraft(seed(offeredSets(list)[0]!)))}>
          {t('blog.ai.qe.deleteSet')}
        </button>
        <button type="button" className="btn" disabled={busy || sets.length === 0} onClick={() => void run({ action: 'reset' }, () => setDraft(seed(DEFAULT_QUESTION_SET)))}>
          {t('blog.ai.qe.reset')}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          {t('blog.ai.qe.back')}
        </button>
      </div>
    </div>
  )
}
