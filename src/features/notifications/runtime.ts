import { runNotifications } from './dispatch'
import { listRules } from './store'

/** The live wiring for runNotifications: D1 rules, the Shop settings admin address, the site name and the email feature. Called after the response. */
export async function notifyEvent(event: string, data: Record<string, unknown>): Promise<void> {
  try {
    const { resolveD1Binding } = await import('@/cms/db/connect')
    const { getEngine } = await import('@/engine')
    const { sendEmail } = await import('@/features/email')
    const d1 = (await resolveD1Binding()) as never
    const engine = await getEngine()
    await runNotifications(
      {
        listRules: () => listRules(d1),
        siteName: async () => {
          try {
            const g = (await engine.findGlobal({ slug: 'site-details', depth: 0, overrideAccess: true })) as { businessName?: unknown }
            return typeof g.businessName === 'string' ? g.businessName : ''
          } catch {
            return ''
          }
        },
        adminEmail: async () => {
          try {
            const g = (await engine.findGlobal({ slug: 'shop-settings', depth: 0, overrideAccess: true })) as { emails?: { adminEmail?: unknown } }
            return typeof g.emails?.adminEmail === 'string' ? g.emails.adminEmail : ''
          } catch {
            return ''
          }
        },
        sendEmail: (args) => sendEmail(args),
        sendPush: async (args) => {
          const { listSubscriptions, loadVapidKeys, removeSubscription } = await import('@/features/push/store')
          const { pushToAll } = await import('@/features/push/send')
          const subs = await listSubscriptions(d1)
          if (subs.length === 0) return
          const keys = await loadVapidKeys(d1, new Date().toISOString())
          const result = await pushToAll(subs, args, keys, process.env.SITE_URL ? `mailto:noreply@${new URL(process.env.SITE_URL).hostname}` : 'mailto:noreply@example.com')
          for (const endpoint of result.removed) await removeSubscription(d1, endpoint)
        },
      },
      event,
      data,
    )
  } catch {
    // Notifications are best effort.
  }
}
