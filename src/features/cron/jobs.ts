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
    return runDueSchedules(engine as never, db as never, now.toISOString())
  },
  'abandoned-carts': async ({ engine }) => {
    const { runAbandonedCartReminders } = await import('@/features/ecommerce/server/abandoned')
    await runAbandonedCartReminders(engine as never)
    // Ended stock holds (Task 23e) are cleaned up on the same timer.
    const { sweepStockHolds } = await import('@/features/ecommerce/server/stockHold')
    const connect = await import('@/cms/db/connect')
    await sweepStockHolds((await connect.resolveD1Binding().catch((): null => null)) as never)
  },
  pagespeed: async ({ engine, db }) => {
    const { runDueTests } = await import('@/features/pagespeed/queue')
    await runDueTests(engine as never, db as never)
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
  'scheduled-emails': async ({ engine, now }) => {
    const { runScheduledEmails } = await import('@/features/email/scheduledEmails')
    await runScheduledEmails(engine as never, now)
  },
  'shipment-tracking': async ({ engine, now }) => {
    const { pollTracking } = await import('@/features/ecommerce/server/tracking')
    return pollTracking(engine as never, now)
  },
  'member-dunning': async ({ engine, now }) => {
    const { sweepDunning } = await import('@/features/members/dunningRun')
    return sweepDunning(engine as never, now)
  },
  'demo-reset': async ({ engine, env, now }) => {
    const { getFeatureFlags } = await import('@/utilities/features')
    if (!(await getFeatureFlags()).demos) return 'feature off'
    const { runScheduledReset } = await import('@/features/demos/service')
    return runScheduledReset(engine as never, env.D1 as never, now)
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
    // Guest carts nobody touched for 30 days. A failure here must not fail the clean-up job.
    const { sweepGuestCarts } = await import('@/features/ecommerce/server/accountCart')
    await sweepGuestCarts(engine as never).catch((): number => 0)
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
}
