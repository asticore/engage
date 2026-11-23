// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { planCopy, dropAllSql } from '../../scripts/copy-live-to-staging.mjs'

describe('copy live to staging plan', () => {
  it('needs both databases and refuses the same one', () => {
    expect(planCopy({}).problems.length).toBeGreaterThan(0)
    expect(planCopy({ liveDb: 'site', stagingDb: 'site' }).problems.join(' ')).toMatch(/same as the live/)
  })
  it('requires "staging" in the name unless told otherwise', () => {
    expect(planCopy({ liveDb: 'site', stagingDb: 'site-test' }).problems.join(' ')).toMatch(/contain "staging"/)
    expect(planCopy({ liveDb: 'site', stagingDb: 'site-test', anyName: true }).problems).toEqual([])
    expect(planCopy({ liveDb: 'site', stagingDb: 'site-staging' }).problems).toEqual([])
  })
  it('copies files only when both buckets and both rclone remotes are given', () => {
    expect(planCopy({ liveDb: 'a', stagingDb: 'a-staging' }).files).toBe(false)
    const both = { liveDb: 'a', stagingDb: 'a-staging', liveBucket: 'b1', stagingBucket: 'b2' }
    expect(planCopy(both).problems.join(' ')).toMatch(/rclone/)
    expect(planCopy({ ...both, rcloneLive: 'x', rcloneStaging: 'y' }).files).toBe(true)
    expect(planCopy({ ...both, stagingBucket: 'b1', rcloneLive: 'x', rcloneStaging: 'y' }).problems.join(' ')).toMatch(/same as the live/)
  })
  it('builds the empty-the-database SQL from the table names, skipping internal tables', () => {
    expect(dropAllSql(['eg_pages', 'sqlite_sequence', '_cf_KV', 'we`ird'])).toBe('DROP TABLE IF EXISTS `eg_pages`;\nDROP TABLE IF EXISTS `weird`;')
  })
})
