/**
 * Task 21i: staging flag. A site is a staging site when the environment says so (SITE_ENV=staging, or STAGING=1).
 * It is set in the host's environment, not in the database, so copying the live database to staging cannot
 * switch it off and copying staging to live cannot switch it on. Pure: reads only the environment given.
 */

export const STAGING_NOINDEX = 'noindex, nofollow, noarchive'

export const isStagingEnv = (env: Record<string, string | undefined> = process.env): boolean =>
  (env.SITE_ENV ?? '').trim().toLowerCase() === 'staging' || (env.STAGING ?? '').trim() === '1'

export const isStaging = (): boolean => isStagingEnv(process.env)

export const STAGING_BLOCK_MESSAGE = 'This is a staging site: payments and email are switched off.'

/** Throws on a staging site, so a real payment can never start there. */
export function assertNotStaging(what: string): void {
  if (isStaging()) throw new Error(`${what} is switched off on a staging site.`)
}
