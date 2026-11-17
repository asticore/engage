'use client'

import { useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import type { FeatureFlags } from '@/features/registry'

import { SetupQuestionnaire } from './SetupQuestionnaire'

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
      <section aria-labelledby="setup-q-card-title" className={pending ? 'eg-setuphost-card' : 'eg-setuphost-quiet'}>
        {pending ? (
          <>
            <h2 className="eg-setuphost-title" id="setup-q-card-title">
              {t('setup.q.cardTitle')}
            </h2>
            <p className="eg-setuphost-text">{t('setup.q.cardText')}</p>
            <button className="eg-setuphost-button" onClick={() => setOpen(true)} type="button">
              {t('setup.q.cardButton')}
            </button>
          </>
        ) : (
          <p className="eg-setuphost-text" id="setup-q-card-title">
            {t('setup.q.rerunText')}{' '}
            <button className="eg-setuphost-linkButton" onClick={() => setOpen(true)} type="button">
              {t('setup.q.rerun')}
            </button>{' '}
            <span className="eg-setuphost-note">{t('setup.q.rerunNote')}</span>
          </p>
        )}
      </section>
      {open && <SetupQuestionnaire currentFlags={currentFlags} onClose={() => setOpen(false)} />}
    </>
  )
}
