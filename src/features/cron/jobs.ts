import type { JobContext } from './jobContext'

/**
 * The work of each scheduled job, by registry name (src/features/cron/registry.ts). The cron route runs these on its
 * timer and the Scheduled tasks screen's "Run now" runs one on request, so there is one body per job. Heavy modules
 * are imported when a job runs, not when this file loads.
 *
 * The backups job keeps its own runner in src/features/backups and is not here.
 */

export type JobRunner = (ctx: JobContext) => Promise<unknown>

export const JOB_RUNNERS: Record<string, JobRunner> = {
  schedules: async ({ engine, db, now }) => {
    const { runDueSchedules } = await import('@/features/schedule/runDue')
    const result = await runDueSchedules(engine as never, db as never, now.toISOString())
    // Reviews that have waited past their workflow's due days are chased on the same timer (never fails the run).
    const { runOverdueReviewReminders } = await import('@/features/approval/overdue')
    await runOverdueReviewReminders(engine as never, now).catch((): number => 0)
    return result
  },
  'abandoned-carts': async ({ engine }) => {
    const { runAbandonedCartReminders } = await import('@/features/ecommerce/server/abandoned')
    await runAbandonedCartReminders(engine as never)
    // The expiry reminder shares this job; a failure here must not fail the abandoned-cart run.
    const { runCartExpiryReminders } = await import('@/features/ecommerce/server/cartExpiry')
    await runCartExpiryReminders(engine as never).catch((): { sent: number } => ({ sent: 0 }))
    // Ended stock holds (Task 23e) are cleaned up on the same timer.
    const { sweepStockHolds } = await import('@/features/ecommerce/server/stockHold')
    const connect = await import('@/cms/db/connect')
    await sweepStockHolds((await connect.resolveD1Binding().catch((): null => null)) as never)
    // Waiting-list holds that ran out pass their places to the next person in line.
    const { sweepWaitingList } = await import('@/features/ecommerce/waitingList')
    await sweepWaitingList(engine as never).catch((): number => 0)
  },
  pagespeed: async ({ engine, db }) => {
    const { runDueTests } = await import('@/features/pagespeed/queue')
    await runDueTests(engine as never, db as never)
  },
  'seo-crawl': async ({ engine, db, now }) => {
    const store = await import('@/features/seo/crawl/store')
    const { crawlStep, startCrawl } = await import('@/features/seo/crawl/runner')
    const { configuredSiteOrigin } = await import('@/utilities/siteOrigin')
    const origin = configuredSiteOrigin()
    const handle = db as never
    const [latest] = await store.latestRuns(handle, 1)
    // A crawl in progress is continued a few pages at a time; otherwise a new one starts when the schedule says so.
    if (latest && latest.status === 'running') return crawlStep(handle, latest.id, origin)
    if (!store.scheduleDue(await store.readSchedule(handle), latest?.startedAt ?? null, now)) return null
    const { buildCrawlTargets } = await import('@/features/seo/crawl/targets')
    const { buildSitemapEntries } = await import('@/features/seo/sitemap')
    const entries = (await buildSitemapEntries().catch((): null => null)) ?? []
    const targets = await buildCrawlTargets(engine as never, origin, entries.map((e) => e.url))
    const runId = await startCrawl(handle, 'schedule', targets)
    return crawlStep(handle, runId, origin)
  },
  'webhooks-retry': async ({ engine }) => {
    const { retryDueWebhooks } = await import('@/features/forms/maintenance')
    await retryDueWebhooks(engine as never)
  },
  'webhook-deliveries': async ({ env }) => {
    const { createD1WebhookStore } = await import('@/features/webhooks/store')
    const { createD1InboundStore } = await import('@/features/webhooks/inboundStore')
    const { processDue } = await import('@/features/webhooks/delivery')
    const d1 = async () => env.D1 as never
    const store = createD1WebhookStore(d1)
    await processDue({ store, inbound: createD1InboundStore(d1), retentionDays: () => store.getRetentionDays() })
  },
  'prune-submissions': async ({ engine }) => {
    const { pruneSubmissions } = await import('@/features/forms/maintenance')
    await pruneSubmissions(engine as never)
  },
  'prune-email-log': async ({ engine }) => {
    const { pruneEmailLog } = await import('@/features/email/emailLogStore')
    await pruneEmailLog(engine as never)
  },
  'gift-cards': async ({ engine }) => {
    const { deliverDueGiftCards } = await import('@/features/ecommerce/server/storedValue')
    await deliverDueGiftCards(engine as never)
  },
  'scheduled-emails': async ({ engine, env, now }) => {
    const { runScheduledEmails } = await import('@/features/email/scheduledEmails')
    await runScheduledEmails(engine as never, now)
    // Booking reminders go out on the same timer (never fails the run).
    const { runBookingReminders } = await import('@/features/bookings/reminders')
    const { sendEmail } = await import('@/features/email')
    const site = (await (engine as never as { findGlobal: (a: unknown) => Promise<{ siteName?: string } | null> }).findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): null => null)) ?? {}
    const { runQuoteSweep } = await import('@/features/quotes/expiry')
    return {
      bookingHolds: await (await import('@/features/bookings/payment')).releaseExpiredHolds(env.D1 as never, now),
      bookingReminders: await runBookingReminders(env.D1 as never, now, site.siteName || 'Our team', sendEmail as never),
      quotes: await runQuoteSweep(env.D1 as never, now, site.siteName || 'Our team', sendEmail as never, engine as never),
      auctions: await (await import('@/features/quotes/auctions')).runAuctionSweep(env.D1 as never, engine, now, (await import('@/utilities/siteOrigin')).configuredSiteOrigin()),
    }
  },
  'shipment-tracking': async ({ engine, now }) => {
    const { pollTracking } = await import('@/features/ecommerce/server/tracking')
    return pollTracking(engine as never, now)
  },
  'member-dunning': async ({ engine, now }) => {
    const { sweepDunning } = await import('@/features/members/dunningRun')
    const dunning = await sweepDunning(engine as never, now)
    // Once a day (03:00 UTC): warn people whose saved card is about to expire.
    if (now.getUTCHours() !== 3) return dunning
    const { sweepCardExpiry } = await import('@/features/billing/cardExpiry')
    return { ...dunning, cardExpiry: await sweepCardExpiry(engine as never, now) }
  },
  'demo-reset': async ({ engine, env, now }) => {
    const { getFeatureFlags } = await import('@/utilities/features')
    if (!(await getFeatureFlags()).demos) return 'feature off'
    const { runScheduledReset } = await import('@/features/demos/service')
    return runScheduledReset(engine as never, env.D1 as never, now)
  },
  'affiliate-payable': async ({ now }) => {
    const { sendPayableEmails } = await import('@/features/affiliates/service')
    return sendPayableEmails(now)
  },
  'client-reports': async ({ engine, env, now }) => {
    const { getFeatureFlags } = await import('@/utilities/features')
    if (!(await getFeatureFlags()).clientreports) return 'feature off'
    const { sendDueReports } = await import('@/features/clientReports/service')
    return sendDueReports(engine as never, env.D1 as never, now)
  },
  cleanup: async ({ engine }) => {
    const { runScheduledCleanup } = await import('@/features/cleanup/scheduledCleanup')
    await runScheduledCleanup(engine as never)
    // Guest carts nobody touched for the Cart lifetime setting (30 days by default). A failure here must not fail the clean-up job.
    const { sweepGuestCarts } = await import('@/features/ecommerce/server/accountCart')
    const { normaliseCartLifetime } = await import('@/features/ecommerce/lib/cartLifetime')
    const lifetime = normaliseCartLifetime(await (engine as unknown as { findGlobal: (a: unknown) => Promise<unknown> }).findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true }).catch((): null => null))
    await sweepGuestCarts(engine as never, new Date(), 200, lifetime).catch((): number => 0)
  },
  'error-alert': async ({ engine, now }) => {
    const { runErrorSpikeAlert } = await import('@/features/errors/spikeAlert')
    const report = await runErrorSpikeAlert(engine as never, now)
    if (report.error) throw new Error(report.error)
  },
  'display-rates': async ({ engine, now }) => {
    const { rawD1 } = await import('@/features/ecommerce/server/db')
    const { loadShopCurrency } = await import('@/features/ecommerce/lib/shopCurrency')
    const { refreshDisplayRates } = await import('@/features/ecommerce/server/displayRates')
    const base = await loadShopCurrency(engine as never)
    await refreshDisplayRates((await rawD1()) as never, base, now)
  },
  'taskboard-due': async ({ engine, now }) => {
    const { getFeatureFlags } = await import('@/utilities/features')
    if (!(await getFeatureFlags()).taskboard) return 'feature off'
    const [{ rawD1 }, { sendEmail }, { textToHtml }, { emitWebhookEvent }, { listRules }, { rulesFor }, { runTaskDueReminders }] = await Promise.all([
      import('@/features/ecommerce/server/db'),
      import('@/features/email'),
      import('@/features/email/renderTemplate'),
      import('@/features/webhooks/emit'),
      import('@/features/notifications/store'),
      import('@/features/notifications/rules'),
      import('@/features/taskboard/dueReminders'),
    ])
    const d1 = (await rawD1()) as never
    return runTaskDueReminders({
      d1,
      now,
      siteName: async () => {
        try {
          const g = (await (engine as unknown as { findGlobal: (a: unknown) => Promise<{ businessName?: unknown }> }).findGlobal({ slug: 'site-details', depth: 0, overrideAccess: true }))
          return typeof g.businessName === 'string' ? g.businessName : ''
        } catch {
          return ''
        }
      },
      sendEmail: (args) => sendEmail(args),
      textToHtml,
      emit: (event, data) => emitWebhookEvent(event, data),
      hasRule: async (event) => rulesFor(await listRules(d1), event).length > 0,
    })
  },
}
