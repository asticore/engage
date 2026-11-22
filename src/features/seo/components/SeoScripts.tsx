import React from 'react'
import { cookies, headers } from 'next/headers'
import { getEngine } from '@/lib/engine'
import { ga4UserId } from '../ga4User'

import { pickPublicIds } from '@/features/integrations/publicIds'
import { CONSENT_COOKIE_NAME, isCurrentRecord, parseRecord } from '@/features/consent/consent'
import { normaliseConsentConfig, scriptGate, type ConsentConfig } from '@/features/consent/config'
import { GatedScript } from '@/features/consent/GatedScript'
import { ConsentManager } from '@/features/consent/ConsentManager'
import { consentLogToken } from '@/features/consent/logToken'
import { resolveBannerLogo } from '@/features/consent/bannerLogo'
import { requireOptIn } from '@/features/consent/regions'
import { getPrivacyPolicyPath } from '@/features/site/pages'

import { getSeoContext } from '../settings'
import { getPublicTrackingEvents } from '@/features/tracking/server'
import { pickConsentCategories } from '@/features/integrations/publicIds'
import type { PickerLabels } from '@/features/tracking/picker/TrackingPicker'
import { TrackingPickerLazy } from '@/features/tracking/picker/TrackingPickerLazy'
import { collectionRoute } from '@/admin/adminPaths'
import { TrackingRuntime } from '@/features/tracking/TrackingRuntime'
import { PLATFORM_CATEGORY, type TrackingPlatform } from '@/features/tracking/events'
import { loadPinterestTagId } from '@/features/tracking/pinterestTagId'
import { getAdminRoot } from '@/features/security/settings'
import { isSignedInTrackingAdmin } from '@/features/tracking/adminAccess'
import { getAdminUi } from '@/admin/i18n/serverUi'
import type { UiStringKey } from '@/features/uiStrings'
import { AnalyticsLoader } from './AnalyticsLoader'

export type SeoScriptsProps = {
  /**
   * `head` renders the consent banner, the analytics loader and the custom head
   * snippets; place it as the first child of <body>. `bodyEnd` renders only the
   * body-end snippets; place it as the last child.
   */
  position?: 'head' | 'bodyEnd'
  /** Two-letter country from Cloudflare's cf-ipcountry, read in the root layout. */
  country?: string | null
}

const loadIntegrations = async (): Promise<Record<string, unknown> | null> => {
  try {
    const { getEngine } = await import('@/lib/engine')
    const engine = await getEngine()
    return (await engine
      .findGlobal({ slug: 'integrations', depth: 0, overrideAccess: true })
      .catch((): null => null)) as Record<string, unknown> | null
  } catch {
    // No integrations row yet (fresh install): the defaults apply.
    return null
  }
}

/** The shop's default currency (payment settings), for tracking values that carry none of their own. Never throws. */
const loadSiteCurrency = async (): Promise<string | null> => {
  try {
    const { getEngine } = await import('@/lib/engine')
    const engine = await getEngine()
    const row = (await engine.findGlobal({ slug: 'payment-settings', depth: 0, overrideAccess: true }).catch((): null => null)) as { currency?: unknown } | null
    return typeof row?.currency === 'string' && /^[A-Z]{3}$/.test(row.currency) ? row.currency : null
  } catch {
    return null
  }
}

const decodeCookie = (raw: string | undefined): string | null => {
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

/**
 * What the server can tell about the visitor's choice. The server can see the
 * cookie, so a returning visitor's banner is not rendered first and then
 * removed; the browser still makes the real decision.
 */
const readConsentState = async (consent: ConsentConfig, country: string | null) => {
  const cookieStore = await cookies()
  const stored = parseRecord(decodeCookie(cookieStore.get(CONSENT_COOKIE_NAME)?.value))
  return {
    initialDecided: isCurrentRecord(stored, consent.policyVersion),
    optIn: consent.enabled && requireOptIn(country, consent.mode),
  }
}

/** The consent banner alone, for when the SEO feature is off. */
const ConsentOnly = async ({ consent, country }: { consent: ConsentConfig; country: string | null }) => {
  const { initialDecided, optIn } = await readConsentState(consent, country)
  const logToken = await consentLogToken(consent.policyVersion).catch((): null => null)
  return <ConsentManager config={consent} optIn={optIn} initialDecided={initialDecided} logToken={logToken} reloadOnWithdraw={{ analytics: false, marketing: false }} />
}

/**
 * Analytics, consent and custom code.
 *
 * Custom code is written into the server-rendered HTML but gated: it sits in
 * inert markup until its category is granted (see GatedScript). Analytics is
 * injected by the browser after the decision is known (see AnalyticsLoader),
 * so when opt-in applies no third-party request is made before a yes.
 */
export const SeoScripts = async ({ position = 'head', country = null }: SeoScriptsProps): Promise<React.ReactElement | null> => {
  const context = await getSeoContext()
  const seoOn = context.enabled && Boolean(context.settings)

  const integrations = await loadIntegrations()
  const analytics = seoOn ? (context.settings?.analytics as Record<string, unknown> | undefined) : undefined
  const privacyFallback = await getPrivacyPolicyPath().catch((): null => null)
  const consent = await resolveBannerLogo(normaliseConsentConfig(integrations, analytics, privacyFallback), integrations)

  // Consent is independent of SEO. With SEO off, the banner still shows when
  // consent is on; custom code and analytics tags come from SEO settings, so
  // they stay off as before.
  if (!seoOn) {
    if (position === 'bodyEnd' || !consent.enabled) return null
    return <ConsentOnly consent={consent} country={country} />
  }

  const custom = context.settings?.customCode

  if (position === 'bodyEnd') {
    const html = custom?.bodyEndScripts?.trim()
    return html ? <GatedScript html={html} category={scriptGate(consent, 'body')} label="body-end" /> : null
  }

  const headHtml = custom?.headScripts?.trim()

  // Public IDs: Integrations first, falling back field by field to the old
  // SEO & Analytics values (see pickPublicIds).
  const { gtmContainerId, ga4MeasurementId, metaPixelId, tiktokPixelId, clarityProjectId } = pickPublicIds(integrations, { analytics })

  const pinterestTagId = await loadPinterestTagId()
  // GA4 user_id: only read when the setting is on, so the normal path costs nothing extra.
  const ga4UserIdValue = analytics?.sendUserId === true && ga4MeasurementId ? await signedInGa4UserId(analytics.hashUserId !== false) : undefined
  const { initialDecided, optIn } = await readConsentState(consent, country)
  const logToken = await consentLogToken(consent.policyVersion).catch((): null => null)
  // Withdrawing needs a reload only for a tag or script that no consent signal or API reaches:
  // GA4 and GTM without Consent Mode, TikTok, and custom code (its markup cannot be taken back).
  const hasCustomCode = Boolean(headHtml || custom?.bodyEndScripts?.trim())
  const reloadOnWithdraw = {
    analytics: Boolean(((gtmContainerId || ga4MeasurementId) && !consent.consentModeV2) || hasCustomCode),
    marketing: Boolean(tiktokPixelId || pinterestTagId || hasCustomCode),
  }

  // Tracking events fire only where a platform is connected and an enabled event exists.
  const trackingEvents = await getPublicTrackingEvents()
  const siteCurrency = trackingEvents.length ? await loadSiteCurrency() : null
  const platforms: TrackingPlatform[] = []
  if (metaPixelId) platforms.push('meta')
  if (ga4MeasurementId) platforms.push('ga4')
  if (gtmContainerId) platforms.push('gtm')
  if (tiktokPixelId) platforms.push('tiktok')
  if (pinterestTagId) platforms.push('pinterest')
  const adminPath = await getAdminRoot().catch((): string => '/admin')
  // A signed-in admin's visits are not tracked: the cookie is present whenever an admin session is open.
  const adminSignedIn = await isSignedInTrackingAdmin('read')
  const categories = pickConsentCategories(integrations)

  return (
    <>
      {headHtml ? <GatedScript html={headHtml} category={scriptGate(consent, 'head')} label="head" /> : null}
      <ConsentManager config={consent} optIn={optIn} initialDecided={initialDecided} logToken={logToken} reloadOnWithdraw={reloadOnWithdraw} />
      <AnalyticsLoader
        gtmContainerId={gtmContainerId}
        ga4MeasurementId={ga4MeasurementId}
        ga4UserId={ga4UserIdValue}
        metaPixelId={metaPixelId}
        tiktokPixelId={tiktokPixelId}
        pinterestTagId={pinterestTagId}
        metaCategory={categories.meta}
        tiktokCategory={categories.tiktok}
        clarityProjectId={clarityProjectId}
        optIn={optIn}
        policyVersion={consent.policyVersion}
        consentModeV2={consent.consentModeV2}
      />
      {adminSignedIn ? <TrackingPickerLazy adminSignedIn={adminSignedIn} adminPath={adminPath} eventsRoute={collectionRoute('tracking-events')} saveEndpoint="/api/admin-tracking-events" labels={await pickerLabels()} /> : null}
      {trackingEvents.length && platforms.length ? (
        <TrackingRuntime events={trackingEvents} platforms={platforms} siteCurrency={siteCurrency} policyVersion={consent.policyVersion} optIn={optIn} adminPath={adminPath} suppressed={adminSignedIn} categories={{ meta: categories.meta, tiktok: categories.tiktok, pinterest: PLATFORM_CATEGORY.pinterest, ga4: PLATFORM_CATEGORY.ga4, gtm: PLATFORM_CATEGORY.gtm }} />
      ) : null}
    </>
  )
}

/** The signed-in customer's GA4 user_id, or undefined when nobody is signed in. Never throws. */
async function signedInGa4UserId(hash: boolean): Promise<string | undefined> {
  try {
    const engine = await getEngine()
    const { user } = await engine.auth({ headers: await headers() })
    return await ga4UserId((user as { id?: number | string } | null)?.id, { hash, secret: process.env.ENGAGE_SECRET || '' })
  } catch {
    return undefined
  }
}

/** The picker's strings, in the admin's language (uiStrings `tracking.picker.*`). */
async function pickerLabels(): Promise<PickerLabels> {
  const ui = await getAdminUi().catch((): null => null)
  const t = (key: UiStringKey): string => (ui ? ui.t(key) : key)
  return {
    title: t('tracking.picker.title'),
    hint: t('tracking.picker.hint'),
    selector: t('tracking.picker.selector'),
    matches: t('tracking.picker.matches'),
    notUnique: t('tracking.picker.notUnique'),
    name: t('tracking.picker.name'),
    standardEvent: t('tracking.picker.standardEvent'),
    trigger: t('tracking.picker.trigger'),
    urlRule: t('tracking.picker.urlRule'),
    save: t('tracking.picker.save'),
    saving: t('tracking.picker.saving'),
    saved: t('tracking.picker.saved'),
    saveFailed: t('tracking.picker.saveFailed'),
    testMode: t('tracking.picker.testMode'),
    testFired: t('tracking.picker.testFired'),
    openEvents: t('tracking.picker.openEvents'),
    close: t('tracking.picker.close'),
    copy: t('tracking.picker.copy'),
    copied: t('tracking.picker.copied'),
  }
}

/** Convenience wrapper for the last child of <body>. */
export const SeoBodyScripts = async (): Promise<React.ReactElement | null> => SeoScripts({ position: 'bodyEnd' })
