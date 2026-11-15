import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

import { checkReferenceUpdates, loadReferences } from './references'

/**
 * /admin/references: each reference source Engage ships with (reference/references.json), its pinned version and
 * commit, and whether GitHub has a newer commit. Administrators only. The check is made when the page opens, with a
 * short timeout, and never changes anything: if GitHub cannot be reached the row says so.
 */
export async function ReferencesView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) redirect(adminHref('', await getAdminRoot()))

  const file = loadReferences()
  const updates = new Map((await checkReferenceUpdates(file)).map((u) => [u.id, u]))
  const short = (sha: string | null | undefined) => (sha ? sha.slice(0, 7) : '-')

  return (
    <div className="stack">
      <h1>Reference sources</h1>
      <p className="text-muted">
        Shared sources every install ships with. They work offline from the copy in this repository. An update changes
        only when you update Engage; this page only checks.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Used for</th>
            <th scope="col">Pinned version</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {file.sources.map((source) => {
            const check = updates.get(source.id)
            return (
              <tr key={source.id}>
                <td>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
                  <div className="text-xs text-muted">{source.type}</div>
                </td>
                <td>{source.usedFor}</td>
                <td>
                  {source.version ?? '-'} <span className="text-xs text-muted">({short(source.commit)})</span>
                </td>
                <td>
                  {check?.error ? (
                    <span className="badge badge-outline">{check.error}</span>
                  ) : check?.outdated ? (
                    <span className="badge badge-solid">Newer version available ({short(check.latest)})</span>
                  ) : (
                    <span className="badge">Up to date</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
