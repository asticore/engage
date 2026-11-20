import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import modules from '@/features/rpc/modules.json'

describe('server function stubs', () => {
  it('are up to date (run `node scripts/gen-action-stubs.mjs` when this fails)', () => {
    expect(() => execFileSync('node', ['scripts/gen-action-stubs.mjs', '--check'], { stdio: 'pipe' })).not.toThrow()
  })

  it('no module uses "use server" (that would put back the third copy of the code in the Worker)', () => {
    for (const mod of modules) expect(fs.readFileSync(`src/${mod}.ts`, 'utf8')).not.toMatch(/^\s*['"]use server['"]/m)
  })

  it('no client component imports a server function module directly', () => {
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`
        if (entry.isDirectory()) walk(full)
        else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.client.ts')) {
          const text = fs.readFileSync(full, 'utf8')
          if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(text.slice(0, 2000))) continue
          for (const mod of modules) {
            const base = mod.split('/').pop()!
            const re = new RegExp(`from\\s+['"][^'"]*/${base}['"]`)
            if (re.test(text) && fs.existsSync(`src/${mod}.ts`)) offenders.push(`${full} -> ${mod}`)
          }
        }
      }
    }
    walk('src')
    expect(offenders).toEqual([])
  })
})
