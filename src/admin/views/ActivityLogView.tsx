import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess, isAdminUser } from '@/admin/auth'
import { AdminLink } from '@/admin/adminRoute/AdminLink'
import { getAdminUi } from '@/admin/i18n/serverUi'
import { SortableTable } from '@/admin/table/SortableTable'
import { activityPageHref, parseActivityFilter } from '@/features/security/activityQuery'
import { listActivityCollections, listActivityPage } from '@/features/security/activityStore'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

import { ActivityClearPanel } from './ActivityClearPanel'

const EVENTS = ['create', 'update', 'publish', 'unpublish', 'delete', 'settings.update', 'export', 'login.success', 'login.failed', 'logout', 'password.changed', 'api-key.created', 'api-key.revoked', 'impersonation.started', 'privacy.erase', 'activity.cleared']

/**
 * /admin/security/activity. What people do: sign-ins, edits, publishes, setting
 * changes and exports, newest first. Filter by person, event, collection and date;
 * click a person to see only their activity. Administrators only, with a CSV
 * download and a clear (see ActivityClearPanel). Retention is set on the Security screen.
 */
export async function ActivityLogView({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  const ui = await getAdminUi()

  if (!isAdminUser(context.user)) {
    return (
      <div style={{ maxWidth: 820, padding: '1.5rem' }}>
        <p>Only an administrator can see the activity log.</p>
      </div>
    )
  }

  const filter = parseActivityFilter(searchParams ?? {})
  const [page, collections] = await Promise.all([listActivityPage(filter).catch((): null => null), listActivityCollections().catch((): string[] => [])])
  const query = activityPageHref({ ...filter, page: 1 }, 1)
  const exportHref = `/api/admin-activity-log${query === '?' ? '?' : `${query}&`}format=csv`

  return (
    <div style={{ maxWidth: 1120, padding: '1.5rem' }}>
      <h1>Activity log</h1>
      <p>
        Sign-ins, edits, publishes, deletes, setting changes and exports, newest first. Sign-in and security events also appear with more detail in the{' '}
        <AdminLink path="/security/audit">Security audit</AdminLink>. How long entries are kept is set in the audit log section of the Security settings.
      </p>

      <form method="get" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', margin: '1rem 0' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Person (email or ID)</span>
          <input type="text" name="person" defaultValue={filter.person ?? ''} maxLength={255} />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Event</span>
          <select name="action" defaultValue={filter.action ?? ''}>
            <option value="">All events</option>
            {EVENTS.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Collection</span>
          <select name="collection" defaultValue={filter.collection ?? ''}>
            <option value="">All</option>
            {collections.map((slug) => <option key={slug} value={slug}>{slug}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>From</span>
          <input type="date" name="from" defaultValue={filter.from ?? ''} />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>To</span>
          <input type="date" name="to" defaultValue={filter.to ?? ''} />
        </label>
        <button type="submit">Filter</button>
      </form>

      {page === null ? (
        <p role="alert">{ui.t('audit.loadFailed')}</p>
      ) : page.rows.length === 0 ? (
        <p>{ui.t('audit.noMatch')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <SortableTable
            columns={[
              { key: 'when', label: 'When (UTC)' },
              { key: 'person', label: 'Person' },
              { key: 'event', label: 'Event' },
              { key: 'item', label: 'Item' },
              { key: 'detail', label: 'Detail' },
              { key: 'address', label: 'Address' },
            ]}
            caption={ui.t('table.sortPageOnly')}
            rows={page.rows.map((row) => {
              const person = row.actorEmail ?? (row.actorId !== null ? `#${row.actorId}` : '-')
              const personKey = row.actorEmail ?? (row.actorId !== null ? String(row.actorId) : null)
              const item = [row.collectionSlug, row.documentId].filter(Boolean).join(' ') || '-'
              return {
                id: String(row.id),
                sortValues: { when: row.createdAt, person, event: row.action, item, detail: row.detail ?? '-', address: row.ip ?? '-' },
                cells: {
                  when: row.createdAt.replace('T', ' ').slice(0, 19),
                  person: personKey ? <a href={activityPageHref({ ...filter, person: personKey, page: 1 }, 1)}>{person}</a> : person,
                  event: <code>{row.action}</code>,
                  item,
                  detail: row.detail ?? '-',
                  address: row.ip ?? '-',
                },
              }
            })}
          />
        </div>
      )}

      {page ? (
        <nav aria-label={ui.t('aria.pages')} style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          {filter.page > 1 ? <a href={activityPageHref(filter, filter.page - 1)}>Newer</a> : null}
          <span>Page {filter.page}</span>
          {page.hasNext ? <a href={activityPageHref(filter, filter.page + 1)}>Older</a> : null}
        </nav>
      ) : null}

      <ActivityClearPanel exportHref={exportHref} defaultPerson={filter.person ?? ''} />
    </div>
  )
}
