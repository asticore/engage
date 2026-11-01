import { redirect } from 'next/navigation'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { listSuppressions } from '@/features/email/suppressionAdmin'
import { EmailSuppressionsClient } from './EmailSuppressionsClient'

/**
 * The suppression list at /admin/email-suppressions: every address that bulk and
 * reminder mail skips, newest first, with a search box and a Remove button per row.
 * Admins only (the list decides who gets mail).
 */
export async function EmailSuppressionsView({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> } = {}) {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) redirect(adminHref('', await getAdminRoot()))

  const raw = searchParams?.q
  const query = typeof raw === 'string' ? raw : ''
  const rows = await listSuppressions(query).catch((): [] => [])

  return (
    <div className="list-view">
      <div className="list-header">
        <h1>Email suppression list</h1>
      </div>
      <p className="doc-muted">
        Addresses listed here get no bulk or reminder email. Order and sign-in emails still go out. Removing an address lets it receive mail again; it
        does not change what the email provider holds.
      </p>
      <form method="get" role="search" className="list-toolbar" aria-label="Search the suppression list">
        <label htmlFor="suppression-search">Search by address</label>{' '}
        <input id="suppression-search" name="q" type="search" defaultValue={query} maxLength={120} />{' '}
        <button type="submit" className="list-toolbar-btn">Search</button>
      </form>
      <EmailSuppressionsClient rows={rows} />
    </div>
  )
}
