import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { loadWebhooksAction } from '@/features/webhooks/actions'
import { loadInboundAction } from '@/features/webhooks/inboundActions'
import { InboundPanel, RetentionPanel } from '@/features/webhooks/components/InboundPanel'
import { WebhooksPanel } from '@/features/webhooks/components/WebhooksPanel'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { resolveAccess } from '@/features/roles/permissions'

/**
 * /admin/webhooks. Admins, and anyone holding the `webhooks` permission, can build webhooks, inbound
 * endpoints and the log retention.
 * The check is repeated in every server action, so a page load alone grants nothing.
 */
export async function WebhooksView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  const allowed = context.isAdmin || resolveAccess(context.user as never, 'webhooks', 'read') === 'all'
  if (!allowed) redirect(adminHref('/', await getAdminRoot()))
  const result = await loadWebhooksAction()
  if (!result.ok || !result.value) {
    return (
      <div style={{ maxWidth: 820, padding: '1.5rem' }}>
        <p>{result.ok === false ? result.error : ''}</p>
      </div>
    )
  }
  const inbound = await loadInboundAction()
  return (
    <>
      <WebhooksPanel initial={result.value} />
      {inbound.ok && inbound.value ? (
        <div style={{ maxWidth: 1040, padding: '0 1.5rem 1.5rem', display: 'grid', gap: '1.5rem' }}>
          <InboundPanel initial={inbound.value} />
          <RetentionPanel initial={inbound.value} />
        </div>
      ) : null}
    </>
  )
}
