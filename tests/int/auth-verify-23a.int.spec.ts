import { describe, expect, it } from 'vitest'

import { PENDING_TWO_FACTOR_SECONDS } from '@/localapi/auth'
import { BACKUP_CODE_COUNT, generateBackupCodes, hashBackupCode } from '@/features/security/twoFactor'

describe('23a verified behaviour', () => {
  it('makes exactly 10 distinct backup codes shaped xxxxx-xxxxx', () => {
    const codes = generateBackupCodes()
    expect(BACKUP_CODE_COUNT).toBe(10)
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const code of codes) expect(code).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/)
  })
  it('stores only hashes, and a typed code matches however it is spaced or capitalised', async () => {
    const [code] = generateBackupCodes(1)
    const hash = await hashBackupCode(code)
    expect(hash).not.toContain(code.replace('-', ''))
    expect(await hashBackupCode(code.toUpperCase().replace('-', ' '))).toBe(hash)
  })
  it('keeps the pending two-step token short lived', () => {
    expect(PENDING_TWO_FACTOR_SECONDS).toBeLessThanOrEqual(300)
  })
})
