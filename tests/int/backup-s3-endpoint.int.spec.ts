import { describe, expect, it } from 'vitest'

import { normaliseEndpoint, resolveDestination } from '@/features/backups/destinations'
import { DEFAULT_BACKUP_SETTINGS, type BackupSettings } from '@/features/backups/types'

const withS3 = (extra: Record<string, string>): BackupSettings => ({
  ...DEFAULT_BACKUP_SETTINGS,
  destination: { provider: 's3', bucket: 'b', region: 'us-west-004', accessKeyId: 'k', secretAccessKey: 's', ...extra },
})

describe('S3 custom endpoint', () => {
  it('normalises endpoints', () => {
    expect(normaliseEndpoint('')).toBe('')
    expect(normaliseEndpoint(' https://s3.wasabisys.com/ ')).toBe('https://s3.wasabisys.com')
    expect(normaliseEndpoint('http://minio.local')).toBeNull()
    expect(normaliseEndpoint('nonsense')).toBeNull()
  })

  it('uses Amazon when no endpoint is set', () => {
    const r = resolveDestination(withS3({}))
    expect(r.ok).toBe(true)
    expect(r.label).toBe('S3 b (us-west-004)')
  })

  it('uses a custom endpoint and refuses plain http', () => {
    const ok = resolveDestination(withS3({ endpoint: 'https://s3.us-west-004.backblazeb2.com' }))
    expect(ok.ok).toBe(true)
    expect(ok.label).toContain('backblazeb2.com')
    const bad = resolveDestination(withS3({ endpoint: 'http://x.test' }))
    expect(bad.ok).toBe(false)
  })
})
