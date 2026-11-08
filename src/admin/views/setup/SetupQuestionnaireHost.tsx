'use client'

import { useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import type { FeatureFlags } from '@/features/registry'

import { SetupQuestionnaire } from './SetupQuestionnaire'
import styles from './SetupQuestionnaireHost.module.css'

type Props = {
  /** True while the owner has neither answered nor skipped: the dialog opens by itself, once per page load. */
  pending: boolean
  /** True when the page was opened with ?setup=1 (the questions run again on request). */
  requested: boolean
  currentFlags: Partial<FeatureFlags>
}

/**
 * Dashboard card for the setup questions. While they are pending the dialog opens on load and a
 * "Set up your site" card reopens it; afterwards a quiet "Run setup questions again" link is shown.
 */
export function SetupQuestionnaireHost({ pending, requested, currentFlags }: Props) {
  const t = useAdminT()
  const [open, setOpen] = useState(pending || requested)

  return (
    <>
      <section aria-labelledby="setup-q-card-title" className={pending ? styles.card : styles.quiet}>
        {pending ? (
          <>
            <h2 className={styles.title} id="setup-q-card-title">
              {t('setup.q.cardTitle')}
            </h2>
            <p className={styles.text}>{t('setup.q.cardText')}</p>
            <button className={styles.button} onClick={() => setOpen(true)} type="button">
              {t('setup.q.cardButton')}
            </button>
          </>
        ) : (
          <p className={styles.text} id="setup-q-card-title">
            {t('setup.q.rerunText')}{' '}
            <button className={styles.linkButton} onClick={() => setOpen(true)} type="button">
              {t('setup.q.rerun')}
            </button>{' '}
            <span className={styles.note}>{t('setup.q.rerunNote')}</span>
          </p>
        )}
      </section>
      {open && <SetupQuestionnaire currentFlags={currentFlags} onClose={() => setOpen(false)} />}
    </>
  )
}
