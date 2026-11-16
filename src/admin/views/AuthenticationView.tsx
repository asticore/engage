import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { describeAuthMethods } from '@/features/security/authMethods'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot, getSecuritySettings } from '@/features/security/settings'
import { readSocialConfig } from '@/features/socialLogin/settings'

const BADGE = { on: 'On', off: 'Off', 'needs-setup': 'Needs setup' } as const

/** /admin/authentication: every sign-in method in one list with its status and a link to where it is set. Admin only, read only. */
export async function AuthenticationView() {
  const context = await getAdminContext()
  const root = await getAdminRoot()
  if (!context.user) redirect(adminHref('/login', root))
  if (!context.isAdmin) return <p>Only an admin can see the authentication overview.</p>
  const [settings, social] = await Promise.all([getSecuritySettings(context.engine as never), readSocialConfig(context.engine as never)])
  const rows = describeAuthMethods(settings, social)
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Authentication</h1>
        <p className="settings-page__description">Every way people can sign in, and whether it is on. Change a method on the screen it links to.</p>
      </div>
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
              <td>{BADGE[row.status]}</td>
              <td>{row.detail}</td>
              <td>
                <a href={adminHref(row.href, root)}>Open</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AuthenticationView
