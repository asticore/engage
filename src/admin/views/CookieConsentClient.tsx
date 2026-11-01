'use client'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Field } from '@/engine'
import { normaliseConsentConfig, type ConsentConfig } from '@/features/consent/config'
import { useFormFields } from '@/admin/context'
import { resolveActiveTab } from '@/admin/settingsPages'
import { EditForm } from './EditForm'
import { CookieConsentPreview } from './CookieConsentPreview'
import { CookieConsentLog } from './CookieConsentLog'
import '@/app/(engage)/settings-tabs.css'
import './cookie-consent.css'

export const COOKIE_CONSENT_TABS = [
  { slug: 'banner', label: 'Banner' },
  { slug: 'preview', label: 'Preview' },
  { slug: 'log', label: 'Consent log' },
] as const

const TAB_SLUGS: readonly string[] = COOKIE_CONSENT_TABS.map((tab) => tab.slug)
const TAB_SELECT_EVENT = 'cookie-consent-tabs:select'

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  window.addEventListener('popstate', onChange)
  window.addEventListener(TAB_SELECT_EVENT, onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(TAB_SELECT_EVENT, onChange)
  }
}

const readHash = () => window.location.hash
// Server render and hydration both see no hash, so the first tab shows until the client reads the URL.
const readServerHash = () => ''

type Props = {
  doc: Record<string, unknown>
  /** The Integrations fields with the consent group revealed. */
  fields: Field[]
  /** The saved consent settings, normalised. */
  config: ConsentConfig
}

/**
 * Reads the consent fields of the form as they are now (saved or not) and hands
 * the normalised banner settings up, so the Preview tab shows unsaved edits.
 * Form values are flat: the consent group's fields are named `consent.<field>`.
 */
function ConsentDraftBridge({ onChange, fallbackPrivacyUrl }: { onChange: (config: ConsentConfig) => void; fallbackPrivacyUrl: string | null }): null {
  const fields = useFormFields(([values]) => values)
  const key = useMemo(() => {
    const consent: Record<string, unknown> = {}
    for (const [path, entry] of Object.entries(fields ?? {})) {
      if (path.startsWith('consent.')) consent[path.slice('consent.'.length)] = entry?.value
    }
    return JSON.stringify(consent)
  }, [fields])
  useEffect(() => {
    onChange(normaliseConsentConfig({ consent: JSON.parse(key) as Record<string, unknown> }, null, fallbackPrivacyUrl))
  }, [key, onChange, fallbackPrivacyUrl])
  return null
}

/**
 * Cookie consent page: Banner (the settings form), Preview and Consent log.
 *
 * The Banner panel stays mounted while another tab is showing, so unsaved
 * edits survive a tab switch. The form shows only the consent group; every
 * other Integrations field stays in its form state, so saving sends the whole
 * global back with those values unchanged.
 */
export const CookieConsentClient: React.FC<Props> = ({ doc, fields, config }) => {
  const t = useAdminT()
  const [draft, setDraft] = useState<ConsentConfig>(config)
  const hash = useSyncExternalStore(subscribeToHash, readHash, readServerHash)
  const active = resolveActiveTab(hash, TAB_SLUGS)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const select = (slug: string) => {
    window.history.replaceState(null, '', `#${slug}`)
    window.dispatchEvent(new Event(TAB_SELECT_EVENT))
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TAB_SLUGS.length - 1
    let next: number
    switch (event.key) {
      case 'ArrowRight':
        next = index === last ? 0 : index + 1
        break
      case 'ArrowLeft':
        next = index === 0 ? last : index - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      default:
        return
    }
    event.preventDefault()
    select(TAB_SLUGS[next])
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="settings-page cc-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Cookie consent</h1>
        <p className="settings-page__description">Change the cookie banner, preview it, and see what visitors chose.</p>
      </div>

      <div className="settings-page__sections">
        <div className="settings-page__section settings-tabs">
          <div role="tablist" aria-label={t('aria.cookieConsent')} className="settings-tabs__list">
            {COOKIE_CONSENT_TABS.map((tab, index) => {
              const selected = tab.slug === active
              return (
                <button
                  key={tab.slug}
                  ref={(el) => {
                    tabRefs.current[index] = el
                  }}
                  id={`cc-tab-${tab.slug}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`cc-panel-${tab.slug}`}
                  tabIndex={selected ? 0 : -1}
                  className="settings-tabs__tab"
                  onClick={() => select(tab.slug)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div
            id="cc-panel-banner"
            role="tabpanel"
            aria-labelledby="cc-tab-banner"
            hidden={active !== 'banner'}
            tabIndex={0}
            className="settings-tabs__panel"
          >
            <EditForm
              doc={doc}
              fields={fields}
              globalSlug="integrations"
              onlyGroups={['consent']}
              afterFields={<ConsentDraftBridge onChange={setDraft} fallbackPrivacyUrl={config.privacyPolicyUrl} />}
            />
          </div>

          <div
            id="cc-panel-preview"
            role="tabpanel"
            aria-labelledby="cc-tab-preview"
            hidden={active !== 'preview'}
            tabIndex={0}
            className="settings-tabs__panel"
          >
            {active === 'preview' ? <CookieConsentPreview config={draft} /> : null}
          </div>

          <div
            id="cc-panel-log"
            role="tabpanel"
            aria-labelledby="cc-tab-log"
            hidden={active !== 'log'}
            tabIndex={0}
            className="settings-tabs__panel"
          >
            {active === 'log' ? <CookieConsentLog logEnabled={config.logConsent} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CookieConsentClient
