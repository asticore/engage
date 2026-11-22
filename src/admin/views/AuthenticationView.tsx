import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { describeAuthMethods } from '@/features/security/authMethods'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot, getSecuritySettings } from '@/features/security/settings'
import { readSocialConfig } from '@/features/socialLogin/settings'
import { getFeatureFlags } from '@/utilities/features'

import { describeSpamCounts, loadSpamCounts } from '@/features/forms/spamCounts'
import { loadBotFlags } from '@/features/security/authStats'
import { CAPTCHA_PLACES } from '@/features/security/captchaPlaces'
import { MATRIX_METHODS, methodAllowed, readMatrix } from '@/features/security/authMatrix'

import { getAdminUi } from '@/admin/i18n/serverUi'
import { testKind } from '@/features/security/authMethodTest'

import { AreaToggle, AuthMethodTest, AuthMethodToggle } from './AuthMethodToggle'

const BADGE = { on: 'On', off: 'Off', 'needs-setup': 'Needs setup' } as const

/** /admin/authentication: every sign-in method in one list with its status and a link to where it is set. Admin only, read only. */
export async function AuthenticationView() {
  const context = await getAdminContext()
  const root = await getAdminRoot()
  if (!context.user) redirect(adminHref('/login', root))
  if (!context.isAdmin) return <p>Only an admin can see the authentication overview.</p>
  const ui = await getAdminUi()
  const [settings, social] = await Promise.all([getSecuritySettings(context.engine as never), readSocialConfig(context.engine as never)])
  const featureOn = Boolean((await getFeatureFlags()).agents)
  let activeTokens = 0
  if (featureOn) {
    const { rawD1 } = await import('@/features/ecommerce/server/db')
    const { listGrants } = await import('@/features/agentAccess/store')
    activeTokens = (await listGrants((await rawD1()) as never).catch((): never[] => [])).filter((g) => !g.revokedAt).length
  }
  const ssoOn = Boolean((await getFeatureFlags()).sso)
  let ssoConnections = 0
  let ssoEnforced = 0
  if (ssoOn) {
    const { listConnectionsSafe } = await import('@/features/orgSso/store')
    const all = await listConnectionsSafe()
    ssoConnections = all.filter((c) => c.enabled).length
    ssoEnforced = all.filter((c) => c.enabled && c.enforce).length
  }
  const rows = describeAuthMethods(settings, social, { featureOn, apiKeysOn: settings.apiKeys.enabled, activeTokens }, { featureOn: ssoOn, connections: ssoConnections, enforced: ssoEnforced })
  const matrix = await readMatrix()
  const flagged = await import('@/features/ecommerce/server/db').then(async ({ rawD1 }) => loadBotFlags((await rawD1()) as never, 7, new Date())).catch((): null => null)
  const spamLine = await import('@/features/ecommerce/server/db').then(async ({ rawD1 }) => describeSpamCounts(await loadSpamCounts((await rawD1()) as never, new Date()))).catch(() => '')
  const matrixRows = rows.filter((row) => (MATRIX_METHODS as readonly string[]).includes(row.id))
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Authentication</h1>
        <p className="settings-page__description">Every way people can sign in, and whether it is on. Switch a method on or off here, or open its screen for the details. A method that is off is hidden from the sign-in form.</p>
      </div>
      {flagged && (
        <p className="settings-page__description">
          Bot protection, last 7 days: {flagged.total} visitor{flagged.total === 1 ? '' : 's'} flagged by the Cloudflare bot score ({flagged.asked} asked for the challenge, {flagged.refused} refused).
          {flagged.places.length > 0 && ` By place: ${flagged.places.map((p) => `${CAPTCHA_PLACES.find((c) => c.id === p.place)?.label ?? p.place} ${p.count}`).join(', ')}.`} Counted once per address and hour. Set up in Form settings, Spam protection.
        </p>
      )}
      {spamLine && <p className="settings-page__description">{spamLine}</p>}
      <table>
        <thead>
          <tr>
            <th scope="col">Method</th>
            <th scope="col">Status</th>
            <th scope="col">Details</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td>{row.toggle ? <AuthMethodToggle id={row.id} label={row.label} on={row.status === 'on'} /> : BADGE[row.status]}</td>
              <td>{row.detail}</td>
              <td>
                <a href={adminHref(row.href, root)}>Open</a>
                {testKind(row.id) ? <AuthMethodTest id={row.id} label={row.label} text={ui.t('auth.test')} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Who can sign in with what</h2>
      <p>Staff sign in at the admin sign-in, shop customers at <code>/account/sign-in</code> and members at <code>/account/member-sign-in</code>. A blocked method disappears from that form and is refused by the server. Staff always keep their password; a customer or member sign-in can block its password only while another way in is left. Two-step codes are asked for after a social sign-in too.</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Method</th>
            <th scope="col">Admin sign-in</th>
            <th scope="col">Customer sign-in</th>
            <th scope="col">Member sign-in</th>
          </tr>
        </thead>
        <tbody>
          {matrixRows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td>{row.id === 'password' ? 'Always allowed' : <AreaToggle area="admin" method={row.id} label={row.label} allowed={methodAllowed(matrix, 'admin', row.id)} />}</td>
              <td><AreaToggle area="account" method={row.id} label={row.label} allowed={methodAllowed(matrix, 'account', row.id)} /></td>
              <td><AreaToggle area="members" method={row.id} label={row.label} allowed={methodAllowed(matrix, 'members', row.id)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AuthenticationView
