import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

describe('generated utility classes', () => {
  it('src/styles/engage-utilities.css is up to date and every used class resolves', () => {
    const r = spawnSync('node', ['scripts/generate-utilities.mjs', '--check'], { encoding: 'utf8' })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
  })
})
