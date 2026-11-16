import { textToHtml } from '@/features/email/renderTemplate'

import type { D1 } from './store'

/**
 * Tells staff about a new chat or an offline message, by email and web push. Best effort: never throws, and a failed email must
 * not stop a visitor's chat. Everything heavy is imported inside the function so this file can be loaded from route handlers cheaply.
 */

async function siteName(): Promise<string> {
  try {
    const { getEngine } = await import('@/engine')
    const g = (await (await getEngine()).findGlobal({ slug: 'site-details', depth: 0, overrideAccess: true })) as { businessName?: unknown }
    return typeof g.businessName === 'string' ? g.businessName : ''
  } catch {
    return ''
  }
}

async function adminAddress(): Promise<string> {
  try {
    const { getEngine } = await import('@/engine')
    const g = (await (await getEngine()).findGlobal({ slug: 'shop-settings', depth: 0, overrideAccess: true })) as { emails?: { adminEmail?: unknown } }
    return typeof g.emails?.adminEmail === 'string' ? g.emails.adminEmail : ''
  } catch {
    return ''
  }
}

export async function sendVisitorEmail(to: string, subject: string, text: string, template: string): Promise<boolean> {
  try {
    const { sendEmail } = await import('@/features/email')
    const result = await sendEmail({ to, subject: subject.replace(/[\r\n]+/g, ' '), text, html: textToHtml(text), template })
    return Boolean((result as { ok?: boolean }).ok)
  } catch {
    return false
  }
}

export async function notifyStaff(d1: D1, args: { kind: 'chat' | 'offline'; name: string; message: string; notifyEmail: string; push: boolean; adminPath: string }): Promise<void> {
  const site = await siteName()
  const title = args.kind === 'chat' ? `New chat${args.name ? ` from ${args.name}` : ''}` : `Offline message${args.name ? ` from ${args.name}` : ''}`
  const body = args.message.slice(0, 300)
  try {
    const to = args.notifyEmail || (await adminAddress())
    if (to) await sendVisitorEmail(to, `${title}${site ? ` (${site})` : ''}`, `${body}\n\nOpen the inbox: ${args.adminPath}`, 'livechat.new')
  } catch {
    // Email is best effort.
  }
  if (!args.push) return
  try {
    const { listSubscriptions, loadVapidKeys, removeSubscription } = await import('@/features/push/store')
    const { pushToAll } = await import('@/features/push/send')
    const subs = await listSubscriptions(d1 as never)
    if (subs.length === 0) return
    const keys = await loadVapidKeys(d1 as never, new Date().toISOString())
    const result = await pushToAll(subs, { title, body, url: args.adminPath }, keys, process.env.SITE_URL ? `mailto:noreply@${new URL(process.env.SITE_URL).hostname}` : 'mailto:noreply@example.com')
    for (const endpoint of result.removed) await removeSubscription(d1 as never, endpoint)
  } catch {
    // Push is best effort.
  }
}
