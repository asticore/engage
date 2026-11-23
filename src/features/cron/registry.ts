import type { FeatureKey } from '@/features/registry'

/**
 * Every scheduled job the site runs, in the order the cron route runs them.
 * The Scheduled tasks screen reads this list; the names must match the
 * runJob() calls in src/app/(engage)/api/cron/publish-scheduled/route.ts
 * (the cron-runjob spec checks that).
 */

export type CronSchedule = 'every 5 minutes' | 'hourly' | 'hourly (checks the backup time)'

export type CronJob = {
  /** Stable key stored on each run row. */
  name: string
  /** Plain-English name for the screen. */
  label: string
  /** One sentence on what the job does. */
  description: string
  schedule: CronSchedule
  /** The feature that must be on for the job to do anything. Null when it always runs. */
  feature: FeatureKey | null
  /** Where the runs are recorded. Backups keep their own run log. */
  source: 'cron' | 'backups'
}

export const CRON_JOBS: CronJob[] = [
  { name: 'schedules', label: 'Scheduled publishing', description: 'Publishes and unpublishes pages, posts, products, events and courses at their set times.', schedule: 'every 5 minutes', feature: null, source: 'cron' },
  { name: 'abandoned-carts', label: 'Abandoned cart emails', description: 'Sends the reminder emails for carts that were left unpaid, when those reminders are switched on.', schedule: 'every 5 minutes', feature: 'ecommerce', source: 'cron' },
  { name: 'pagespeed', label: 'PageSpeed tests', description: 'Runs one queued PageSpeed test after a page is published, when "test after publish" is on.', schedule: 'every 5 minutes', feature: 'speed', source: 'cron' },
  { name: 'webhooks-retry', label: 'Form webhook retries', description: 'Sends again any form submission webhook that failed.', schedule: 'every 5 minutes', feature: 'forms', source: 'cron' },
  { name: 'webhook-deliveries', label: 'Webhook deliveries', description: 'Sends the webhooks builder deliveries that are due, including retries, and removes log entries older than the retention the admin chose (30 days by default).', schedule: 'every 5 minutes', feature: null, source: 'cron' },
  { name: 'prune-submissions', label: 'Form entry clean-up', description: 'Removes form entries that are older than the retention period set on each form.', schedule: 'hourly', feature: 'forms', source: 'cron' },
  { name: 'prune-email-log', label: 'Email log clean-up', description: 'Removes email log entries older than 90 days.', schedule: 'hourly', feature: 'email', source: 'cron' },
  { name: 'gift-cards', label: 'Gift card delivery', description: 'Emails gift cards whose send date has arrived.', schedule: 'every 5 minutes', feature: 'ecommerce', source: 'cron' },
  { name: 'scheduled-emails', label: 'Reminder emails', description: 'Sends membership renewal and event reminder emails, held during quiet hours, the reminder a day before each booking, and closes quotes that ran out and reminds customers 3 days before a quote expires.', schedule: 'every 5 minutes', feature: 'email', source: 'cron' },
  { name: 'shipment-tracking', label: 'Shipment tracking', description: 'Asks the carriers that can answer (Sendle for now) where undelivered parcels are, saves the timeline on the order and emails the customer when it is out for delivery, delivered or has a problem.', schedule: 'hourly', feature: 'ecommerce', source: 'cron' },
  { name: 'member-dunning', label: 'Failed membership payments', description: 'Retries failed membership renewals, emails the member on the schedule set in Members, Billing, and ends or downgrades the membership when the grace period runs out. Once a day it also emails members and subscribers whose saved card expires within 30 days.', schedule: 'hourly', feature: 'members', source: 'cron' },
  { name: 'error-alert', label: 'Error alerts', description: 'Emails the admins when the threshold of new errors (Error alerts on the Speed settings, default 10) is reached within 15 minutes. At most one email an hour.', schedule: 'every 5 minutes', feature: null, source: 'cron' },
  { name: 'display-rates', label: 'Display currency rates', description: 'Refreshes the exchange rates used to show prices in other currencies.', schedule: 'hourly', feature: 'ecommerce', source: 'cron' },
  { name: 'cleanup', label: 'Data clean-up', description: 'Removes old versions, trashed items and logs as set on the Data and system settings, and shop carts that signed-out visitors left untouched for 30 days.', schedule: 'hourly', feature: null, source: 'cron' },
  { name: 'demo-reset', label: 'Demo reset', description: 'Puts the demo site back to its saved copy on the schedule chosen on the Agency demos screen (never, hourly or daily).', schedule: 'hourly', feature: 'demos', source: 'cron' },
  { name: 'affiliate-payable', label: 'Affiliate payable emails', description: 'Emails each affiliate once when a commission has finished its waiting period and can be paid, when affiliate emails are on.', schedule: 'hourly', feature: 'affiliates', source: 'cron' },
  { name: 'client-reports', label: 'Client report emails', description: 'Emails each client report that is set to weekly or monthly when its time has come, with the link to the read-only report.', schedule: 'hourly', feature: 'clientreports', source: 'cron' },
  { name: 'taskboard-due', label: 'Taskboard due reminders', description: 'Reminds the person a task is given to, once per due date, when it is due today or tomorrow or is overdue (not for cards in the last column).', schedule: 'hourly', feature: 'taskboard', source: 'cron' },
  { name: 'seo-crawl', label: 'SEO site audit', description: 'Crawls this site\'s own pages for the SEO dashboard on the schedule chosen there (off, daily or weekly), a few pages at a time, and works out the health score when the crawl is complete.', schedule: 'every 5 minutes', feature: 'seo', source: 'cron' },
  { name: 'gcal-sync', label: 'Google Calendar sync', description: 'Copies events both ways between the Events list and the chosen Google calendars, at the interval set on the Google connection page, when the sync is on.', schedule: 'every 5 minutes', feature: 'events', source: 'cron' },
  { name: 'backups', label: 'Backups', description: 'Takes the scheduled site backup at the time set on the Backups screen.', schedule: 'hourly (checks the backup time)', feature: 'backups', source: 'backups' },
]

export const cronJobNames = (): string[] => CRON_JOBS.filter((job) => job.source === 'cron').map((job) => job.name)
