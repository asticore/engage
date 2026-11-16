import { resolveD1Binding } from '@/cms/db/connect'

/**
 * Remembers which pending two-step tokens have already finished a sign-in, so a token that was seen
 * (a log, a shared screen) cannot be replayed inside its 5 minute life. One row per used token in
 * `eg_kv` under `p2fa:<jti>`; the row holds the token's expiry and expired rows are swept on write.
 * Fails open on a read error, like the session checks: the lockout still guards the code itself.
 */

export type PendingTokenOps = {
  isUsed: (jti: string) => Promise<boolean>
  markUsed: (jti: string, expiresAtIso: string) => Promise<void>
}

const PREFIX = 'p2fa:'

export const pendingTokenOps: PendingTokenOps = {
  async isUsed(jti) {
    try {
      const d1 = await resolveD1Binding()
      const row = await d1.prepare('SELECT 1 AS n FROM `eg_kv` WHERE `key` = ?').bind(`${PREFIX}${jti}`).first<{ n: number }>()
      return Boolean(row)
    } catch {
      return false
    }
  },
  async markUsed(jti, expiresAtIso) {
    try {
      const d1 = await resolveD1Binding()
      await d1.prepare('INSERT OR IGNORE INTO `eg_kv` (`key`, `data`) VALUES (?, ?)').bind(`${PREFIX}${jti}`, expiresAtIso).run()
      await d1.prepare('DELETE FROM `eg_kv` WHERE `key` LIKE ? AND `data` < ?').bind(`${PREFIX}%`, new Date().toISOString()).run()
    } catch {
      // A log line's worth of failure: the token still expires in 5 minutes.
    }
  },
}
