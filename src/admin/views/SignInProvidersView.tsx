import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { publicOrigin } from '@/features/google/origin'
import { ExtraProvidersForm } from '@/features/socialLogin/admin/ExtraProvidersForm.nossr'
import { type ExtraCard } from '@/features/socialLogin/admin/ExtraProvidersForm'
import { extraRowFor, readExtraRows } from '@/features/socialLogin/extraStore'
import { EXTRA_PROVIDER_IDS, isUsable, PROVIDERS, redirectUriFor } from '@/features/socialLogin/providers'
import { readSocialConfig } from '@/features/socialLogin/settings'
import { SETUP_GUIDES } from '@/features/socialLogin/setupGuides'
import { socialTestSummary } from '@/features/socialLogin/testResult'

const LABELS: Record<string, [string, string]> = {
  x: ['Client ID', 'Client secret'],
  linkedin: ['Client ID', 'Primary client secret'],
  tiktok: ['Client key', 'Client secret'],
  slack: ['Client ID', 'Client secret'],
  oidc: ['Client ID', 'Client secret'],
}

/** /admin/security/sign-in-providers: set up X, LinkedIn, TikTok, Slack, a free-form OpenID Connect provider and Google One Tap. Admin only. */
export async function SignInProvidersView({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> } = {}) {
  const context = await getAdminContext()
  const root = await getAdminRoot()
  if (!context.user) redirect(adminHref('/login', root))
  if (!context.isAdmin) return <p>Only an admin can change sign-in providers.</p>

  const [rows, config] = await Promise.all([readExtraRows(), readSocialConfig(context.engine as never)])
  const origin = publicOrigin()
  const raw = searchParams?.social_test
  const search = typeof raw === 'string' ? `?social_test=${encodeURIComponent(raw)}` : ''

  const cards: ExtraCard[] = EXTRA_PROVIDER_IDS.map((id) => {
    const row = extraRowFor(rows, id)
    const guide = SETUP_GUIDES[id]
    const settings: Record<string, string | boolean> = {}
    for (const [key, value] of Object.entries(row.settings)) if (typeof value === 'string' || typeof value === 'boolean') settings[key] = value
    return {
      id,
      label: PROVIDERS[id].label,
      enabled: row.enabled,
      clientId: row.clientId,
      hasSecret: Boolean(row.clientSecret),
      redirectConfirmed: row.redirectConfirmed,
      idLabel: LABELS[id][0],
      secretLabel: LABELS[id][1],
      redirectUri: redirectUriFor(origin, id),
      guide: { consoleUrl: guide.consoleUrl, consoleLabel: guide.consoleLabel, scopes: guide.scopes, steps: guide.steps, notes: guide.notes },
      settings,
      testNote: socialTestSummary(search, id),
    }
  })

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">More sign-in providers</h1>
        <p className="settings-page__description">
          X, LinkedIn, TikTok, Slack, any OpenID Connect provider, and Google One Tap. Google, GitHub, Apple, Facebook, Microsoft and Discord are set up on Settings &gt; Security &gt; Social login. Every
          provider is off until you save its credentials and switch it on; the button then appears on the member sign-in page (and for staff, once Social login allows it).
        </p>
      </div>
      <ExtraProvidersForm cards={cards} oneTap={config.googleOneTap} googleReady={isUsable('google', config.providers.google)} />
    </div>
  )
}
