// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  currentNames,
  findD1,
  hasBucket,
  parseArgs,
  parseWranglerJson,
  rewriteWranglerConfig,
  setupCloudflare,
  toCloudflareName,
} from '../../scripts/setup-cloudflare.mjs'

const live = fs.readFileSync(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8')
const liveNames = currentNames(live)

/** A fake wrangler: `state.d1` is the account's D1 list, `state.buckets` its bucket names. Records every call. */
function fakeWrangler(state: { d1: { name: string; uuid: string }[]; buckets: string[] }) {
  const calls: string[][] = []
  const exec = (args: string[]) => {
    calls.push(args)
    if (args[0] === 'd1' && args[1] === 'list') return `⛅️ wrangler 4\n${JSON.stringify(state.d1)}`
    if (args[0] === 'd1' && args[1] === 'create') {
      state.d1.push({ name: args[2], uuid: `new-${args[2]}-id` })
      return 'created'
    }
    if (args[0] === 'r2' && args[1] === 'bucket' && args[2] === 'list') return state.buckets.map((b) => `name: ${b}\ncreation_date: x`).join('\n')
    if (args[0] === 'r2' && args[1] === 'bucket' && args[2] === 'create') {
      state.buckets.push(args[3])
      return 'created'
    }
    throw new Error(`unexpected ${args.join(' ')}`)
  }
  return { exec, calls }
}

describe('setup-cloudflare: names', () => {
  it('reads the live values from wrangler.jsonc', () => {
    expect(liveNames).toMatchObject({ workerName: 'gracengatsby', databaseName: 'Gracengatsby', bucketName: 'gracengatsby', previewBucketName: 'gracengatsby' })
    expect(liveNames.databaseId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('turns any input into a Cloudflare-safe name and refuses unusable ones', () => {
    expect(toCloudflareName('My Shop!')).toBe('my-shop')
    expect(toCloudflareName('--Grace_and_Gatsby--')).toBe('grace-and-gatsby')
    expect(() => toCloudflareName('ab')).toThrow(/usable Cloudflare name/)
  })

  it('defaults to the names already in the file, and to the worker name when --worker is given', () => {
    expect(parseArgs([], live, 'folder').names).toEqual({ worker: 'gracengatsby', d1: 'Gracengatsby', bucket: 'gracengatsby' })
    expect(parseArgs(['--worker', 'Shop Site'], live, 'folder').names).toEqual({ worker: 'shop-site', d1: 'shop-site', bucket: 'shop-site' })
    expect(parseArgs(['--d1', 'shop-db'], live, 'folder').names).toMatchObject({ d1: 'shop-db', bucket: 'gracengatsby' })
    expect(() => parseArgs(['--nope'], live, 'folder')).toThrow(/Unknown option/)
  })
})

describe('setup-cloudflare: wrangler.jsonc rewrite', () => {
  it('leaves the live file byte for byte unchanged when the names are the same', () => {
    const same = rewriteWranglerConfig(live, {
      workerName: liveNames.workerName,
      databaseId: liveNames.databaseId,
      databaseName: liveNames.databaseName,
      bucketName: liveNames.bucketName,
    })
    expect(same).toBe(live)
  })

  it('rewrites only the worker, D1 and bucket values and keeps the comments', () => {
    const next = rewriteWranglerConfig(live, {
      workerName: 'shop',
      databaseId: '11111111-2222-3333-4444-555555555555',
      databaseName: 'shop-db',
      bucketName: 'shop-media',
    })
    expect(next).toContain('"name": "shop",')
    expect(next).toContain('"database_id": "11111111-2222-3333-4444-555555555555"')
    expect(next).toContain('"database_name": "shop-db"')
    expect(next).toContain('"bucket_name": "shop-media"')
    expect(next).toContain('"preview_bucket_name": "shop-media"')
    expect(currentNames(next)).toMatchObject({ workerName: 'shop', databaseName: 'shop-db', bucketName: 'shop-media' })
    expect(next.split('\n').filter((l: string) => l.trim().startsWith('//')).length).toBe(live.split('\n').filter((l: string) => l.trim().startsWith('//')).length)
    expect(next.split('\n').length).toBe(live.split('\n').length)
  })

  it('fails loudly when a key the script rewrites is missing', () => {
    const without = live.replace(/"r2_buckets"/, '"r2_buckets_removed"').replace(/"bucket_name"/g, '"bucket_gone"')
    expect(() => rewriteWranglerConfig(without, { workerName: 'a', databaseId: 'b', databaseName: 'c', bucketName: 'd' })).toThrow(/bucket_name/)
  })
})

describe('setup-cloudflare: wrangler CLI output', () => {
  it('skips warning lines before the JSON and finds a database or bucket by name', () => {
    const out = 'WARNING: proxy\n[{"uuid":"abc","name":"shop-db"}]'
    expect(findD1(parseWranglerJson(out), 'shop-db')).toEqual({ id: 'abc' })
    expect(findD1(parseWranglerJson(out), 'other')).toBeNull()
    expect(hasBucket('name: shop-media\ncreation_date: 2026', 'shop-media')).toBe(true)
    expect(hasBucket('name: shop-media-2\n', 'shop-media')).toBe(false)
  })
})

describe('setup-cloudflare: setup run', () => {
  it('creates the D1 database and bucket on an empty account, then does nothing on a second run', () => {
    const state = { d1: [] as { name: string; uuid: string }[], buckets: [] as string[] } as {
      d1: { name: string; uuid: string }[]
      buckets: string[]
    }
    const names = { worker: 'shop', d1: 'shop-db', bucket: 'shop-media' }
    const first = fakeWrangler(state)
    const run1 = setupCloudflare({ names, configText: live, exec: first.exec, replace: true })
    expect(run1.actions).toEqual(['create D1 database shop-db', 'create R2 bucket shop-media'])
    expect(run1.databaseId).toBe('new-shop-db-id')
    expect(run1.changed).toBe(true)
    expect(currentNames(run1.text)).toMatchObject({ workerName: 'shop', databaseId: 'new-shop-db-id', databaseName: 'shop-db', bucketName: 'shop-media' })

    const second = fakeWrangler(state)
    const run2 = setupCloudflare({ names, configText: run1.text, exec: second.exec })
    expect(run2.actions).toEqual(['reuse D1 database shop-db (new-shop-db-id)', 'reuse R2 bucket shop-media'])
    expect(run2.changed).toBe(false)
    expect(run2.text).toBe(run1.text)
    expect(second.calls.some((c) => c[1] === 'create' || c[2] === 'create')).toBe(false)
  })

  it('refuses to change the database ID in the file without --replace, and never writes in a dry run', () => {
    const state = { d1: [{ name: 'shop-db', uuid: 'other-id' }], buckets: ['shop-media'] }
    const names = { worker: 'shop', d1: 'shop-db', bucket: 'shop-media' }
    expect(() => setupCloudflare({ names, configText: live, exec: fakeWrangler(state).exec })).toThrow(/Pass --replace/)
    const dry = setupCloudflare({ names, configText: live, exec: fakeWrangler(state).exec, dryRun: true })
    expect(dry.actions.join(' ')).toContain('would stop')
  })

  it('keeps the live production values when the live names are used against the live account', () => {
    const state = { d1: [{ name: 'Gracengatsby', uuid: liveNames.databaseId }], buckets: ['gracengatsby'] }
    const names = parseArgs([], live, 'folder').names
    const result = setupCloudflare({ names, configText: live, exec: fakeWrangler(state).exec })
    expect(result.changed).toBe(false)
    expect(result.text).toBe(live)
  })
})
