// @vitest-environment node
// Ratchet: the number of `any` types and eslint-disable directives in src/ may only go down.
// The baseline is committed in tests/int/type-ratchet-baseline.json. When a change removes some,
// lower the baseline in the same PR (the test says so); a rise fails here, with no exception.
// `any` is counted from the TypeScript syntax tree (AnyKeyword), so comments and strings never count.
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const BASELINE = JSON.parse(readFileSync(join(ROOT, 'tests/int/type-ratchet-baseline.json'), 'utf8')) as {
  any: number
  eslintDisable: number
  justified: Record<string, string>
}

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|mts|cts)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : []
  })

const measure = (): { any: number; eslintDisable: number; perFile: Record<string, { any: number; eslintDisable: number }> } => {
  let any = 0
  let eslintDisable = 0
  const perFile: Record<string, { any: number; eslintDisable: number }> = {}
  for (const file of sourceFiles(join(ROOT, 'src'))) {
    const text = readFileSync(file, 'utf8')
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    let fileAny = 0
    const visit = (node: ts.Node): void => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) fileAny += 1
      ts.forEachChild(node, visit)
    }
    visit(tree)
    const fileDisables = text.match(/eslint-disable(?:-next-line|-line)?\b/g)?.length ?? 0
    any += fileAny
    eslintDisable += fileDisables
    if (fileAny || fileDisables) perFile[relative(ROOT, file)] = { any: fileAny, eslintDisable: fileDisables }
  }
  return { any, eslintDisable, perFile }
}

describe('type ratchet: src/ may not gain any or eslint-disable', () => {
  const current = measure()

  it('has a one-line reason in the baseline for every file that still has an any or an eslint-disable', () => {
    const missing = Object.keys(current.perFile).filter((file) => !BASELINE.justified[file])
    expect(missing, 'add a one-line reason under "justified" in tests/int/type-ratchet-baseline.json, or fix the occurrence').toEqual([])
  })

  it('does not list files that no longer need a reason', () => {
    const stale = Object.keys(BASELINE.justified).filter((file) => !current.perFile[file])
    expect(stale, 'remove these from "justified" in tests/int/type-ratchet-baseline.json').toEqual([])
  })

  it('has no more `any` types than the baseline', () => {
    if (current.any < BASELINE.any) {
      console.info(`[ratchet] any fell to ${current.any} (baseline ${BASELINE.any}): lower tests/int/type-ratchet-baseline.json`)
    }
    expect(current.any, 'new `any` types in src/: use a real type (unknown, a named shape or a generic) instead').toBeLessThanOrEqual(BASELINE.any)
  })

  it('has no more eslint-disable directives than the baseline', () => {
    if (current.eslintDisable < BASELINE.eslintDisable) {
      console.info(`[ratchet] eslint-disable fell to ${current.eslintDisable} (baseline ${BASELINE.eslintDisable}): lower tests/int/type-ratchet-baseline.json`)
    }
    expect(
      current.eslintDisable,
      'new eslint-disable directives in src/: fix the lint finding instead of silencing it',
    ).toBeLessThanOrEqual(BASELINE.eslintDisable)
  })
})
