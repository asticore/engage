'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { LOCALE_OPTIONS } from '@/features/multilingual/locales'
import { FEATURE_MAP, type FeatureFlags, type FeatureKey } from '@/features/registry'
import {
  BOOKING_KINDS,
  BUSINESS_TYPES,
  NOTE_BOOKINGS,
  NOTE_DOMAINS,
  PRODUCT_KINDS,
  SITE_SHAPES,
  buildSavePayload,
  suggestFeatures,
  type BookingKind,
  type ProductKind,
  type SetupAnswers,
} from '@/features/setup/questionnaire'
import type { UiStringKey } from '@/features/uiStrings'

import styles from './SetupQuestionnaire.module.css'

const STEP_COUNT = 6
const SUMMARY_STEP = STEP_COUNT

const key = (name: string): UiStringKey => `setup.q.${name}` as UiStringKey

const NOTE_KEYS: Record<string, string> = { [NOTE_DOMAINS]: 'note.domains', [NOTE_BOOKINGS]: 'note.bookings' }

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const toggle = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

type Props = {
  /** The flags as saved now, so Apply keeps every switch the owner already made. */
  currentFlags: Partial<FeatureFlags>
  onClose: () => void
}

/**
 * The fresh-install questionnaire: one group of questions per step, then the suggestions to review.
 * Apply saves the ticked sections and the answers in one request; Skip saves only "skipped".
 * Escape closes without saving, so it is offered again on the next visit.
 */
export function SetupQuestionnaire({ currentFlags, onClose }: Props) {
  const t = useAdminT()
  const router = useRouter()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<SetupAnswers>({ products: [], languages: 'one', locales: [] })
  const [chosen, setChosen] = useState<FeatureKey[] | null>(null)
  const [busy, setBusy] = useState<'apply' | 'skip' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const suggestion = useMemo(() => suggestFeatures(answers), [answers])
  const selected = chosen ?? suggestion.on

  // Focus moves into the dialog and back to where it came from; Tab stays inside.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => previous?.focus?.()
  }, [])
  useEffect(() => {
    dialogRef.current?.focus()
  }, [step])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const save = useCallback(
    async (mode: 'apply' | 'skip') => {
      setBusy(mode)
      setError(null)
      try {
        const payload = buildSavePayload(mode, { currentFlags, selected, answers })
        const response = await fetch('/api/globals/site-settings', {
          body: JSON.stringify(payload),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })
        if (!response.ok) {
          const body: unknown = await response.json().catch((): unknown => null)
          const detail = (body as { errors?: Array<{ message?: string }> } | null)?.errors?.[0]?.message
          setError(detail ? t(key('error'), { detail }) : t(key('errorGeneric')))
          return
        }
        onClose()
        router.refresh()
      } catch {
        setError(t(key('errorGeneric')))
      } finally {
        setBusy(null)
      }
    },
    [answers, currentFlags, onClose, router, selected, t],
  )

  const setAnswer = <K extends keyof SetupAnswers>(name: K, value: SetupAnswers[K]): void => {
    setAnswers((prev) => ({ ...prev, [name]: value }))
    setChosen(null)
  }

  const toggleProduct = (kind: ProductKind): void => {
    const current = answers.products ?? []
    const next = kind === 'none' ? (current.includes('none') ? [] : ['none' as ProductKind]) : toggle(current.filter((k) => k !== 'none'), kind)
    setAnswer('products', next)
  }

  const radio = <V extends string>(name: string, values: readonly V[], group: string, current: V | undefined, onPick: (value: V) => void) => (
    <>
      {values.map((value) => (
        <label className={styles.option} key={value}>
          <input checked={current === value} name={name} onChange={() => onPick(value)} type="radio" value={value} />
          <span>{t(key(`${group}.${value}`))}</span>
        </label>
      ))}
    </>
  )

  const check = (id: string, label: string, checked: boolean, onChange: () => void) => (
    <label className={styles.option} key={id}>
      <input checked={checked} onChange={onChange} type="checkbox" />
      <span>{label}</span>
    </label>
  )

  const moreKeys = ['events', 'courses', 'membership', 'blog', 'forms'] as const

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <fieldset className={styles.group}>
            <legend>{t(key('shape.legend'))}</legend>
            {radio('shape', SITE_SHAPES, 'shape', answers.siteShape, (v) => setAnswer('siteShape', v))}
          </fieldset>
        )
      case 2:
        return (
          <fieldset className={styles.group}>
            <legend>{t(key('products.legend'))}</legend>
            <p className={styles.hint}>{t(key('products.hint'))}</p>
            {PRODUCT_KINDS.map((kind) => check(kind, t(key(`products.${kind}`)), (answers.products ?? []).includes(kind), () => toggleProduct(kind)))}
          </fieldset>
        )
      case 3:
        return (
          <fieldset className={styles.group}>
            <legend>{t(key('bookings.legend'))}</legend>
            {radio<BookingKind>('bookings', BOOKING_KINDS, 'bookings', answers.bookings, (v) => setAnswer('bookings', v))}
          </fieldset>
        )
      case 4:
        return (
          <fieldset className={styles.group}>
            <legend>{t(key('more.legend'))}</legend>
            <p className={styles.hint}>{t(key('more.hint'))}</p>
            {moreKeys.map((name) => check(name, t(key(`more.${name}`)), Boolean(answers[name]), () => setAnswer(name, !answers[name])))}
          </fieldset>
        )
      case 5:
        return (
          <>
            <fieldset className={styles.group}>
              <legend>{t(key('languages.legend'))}</legend>
              {radio('languages', ['one', 'several'] as const, 'languages', answers.languages, (v) => setAnswer('languages', v))}
            </fieldset>
            {answers.languages === 'several' && (
              <fieldset className={`${styles.group} ${styles.locales}`}>
                <legend>{t(key('languages.localesLegend'))}</legend>
                {LOCALE_OPTIONS.map((locale) =>
                  check(locale.value, locale.label, (answers.locales ?? []).includes(locale.value), () => setAnswer('locales', toggle(answers.locales ?? [], locale.value))),
                )}
              </fieldset>
            )}
          </>
        )
      case 6:
        return (
          <fieldset className={styles.group}>
            <legend>{t(key('business.legend'))}</legend>
            {radio('business', BUSINESS_TYPES, 'business', answers.businessType, (v) => setAnswer('businessType', v))}
          </fieldset>
        )
      default:
        return (
          <div className={styles.summary}>
            <h3 className={styles.summaryTitle}>{t(key('summary.title'))}</h3>
            {suggestion.on.length === 0 ? (
              <p>{t(key('summary.none'))}</p>
            ) : (
              <fieldset className={styles.group}>
                <legend>{t(key('summary.intro'))}</legend>
                {suggestion.on.map((featureKey) => {
                  const feature = FEATURE_MAP[featureKey]
                  const already = Boolean(currentFlags[featureKey])
                  return (
                    <label className={styles.option} key={featureKey}>
                      <input
                        checked={selected.includes(featureKey)}
                        onChange={() => setChosen(toggle(selected, featureKey))}
                        type="checkbox"
                      />
                      <span>
                        <strong>{feature.label}</strong>
                        {already ? ` (${t(key('summary.alreadyOn'))})` : ''}
                        <span className={styles.featureText}>{feature.description}</span>
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            )}
            {suggestion.notes.length > 0 && (
              <div className={styles.notes}>
                <h4>{t(key('summary.notesTitle'))}</h4>
                <ul>
                  {suggestion.notes.map((note) => (
                    <li key={note}>{NOTE_KEYS[note] ? t(key(NOTE_KEYS[note])) : note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
    }
  }

  const onSummary = step === SUMMARY_STEP + 1
  const total = STEP_COUNT + 1

  return (
    <div className={styles.backdrop}>
      <div aria-labelledby={titleId} aria-modal="true" className={styles.dialog} onKeyDown={onKeyDown} ref={dialogRef} role="dialog" tabIndex={-1}>
        <h2 className={styles.title} id={titleId}>
          {t(key('title'))}
        </h2>
        <p aria-live="polite" className={styles.progress}>
          {t(key('stepOf'), { n: step, m: total })}
        </p>
        {step === 1 && <p className={styles.intro}>{t(key('intro'))}</p>}
        <div className={styles.body}>{renderStep()}</div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button className={styles.link} disabled={busy !== null} onClick={() => void save('skip')} type="button">
            {t(key('skip'))}
          </button>
          <span className={styles.spacer} />
          {step > 1 && (
            <button className={styles.secondary} disabled={busy !== null} onClick={() => setStep(step - 1)} type="button">
              {t(key('back'))}
            </button>
          )}
          {onSummary ? (
            <button className={styles.primary} disabled={busy !== null} onClick={() => void save('apply')} type="button">
              {busy === 'apply' ? t(key('saving')) : t(key('apply'))}
            </button>
          ) : (
            <button className={styles.primary} onClick={() => setStep(step + 1)} type="button">
              {t(key('next'))}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
