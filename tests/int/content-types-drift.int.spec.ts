// @vitest-environment node
// Drift between src/engage-types.ts (the hand-written types the app reads) and the generated schema in
// src/cms/db/schema (the source of truth). Rules live in tests/helpers/contentTypeDrift.ts:
//  - every key a mapped type declares must be a column, stored in a related table, or listed as virtual;
//  - every column of a content collection must be declared (globals may model only part of their settings).
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CONTENT_TYPES,
  compareType,
  loadDeclared,
  loadSchema,
  type DriftReport,
} from '../helpers/contentTypeDrift'

const { tables, exportNames } = loadSchema()
const mapOf = new Map(CONTENT_TYPES.map((m) => [m.type, m]))
const declared = loadDeclared(path.join(process.cwd(), 'src/engage-types.ts'), (iface) => {
  const m = mapOf.get(iface)
  return new Set(m ? Object.keys(tables.get(m.table)?.columns ?? {}) : [])
})
const reports: DriftReport[] = CONTENT_TYPES.map((m) => compareType(m, declared.get(m.type) ?? [], tables.get(m.table), exportNames))

describe('content types (engage-types.ts) against the schema', () => {
  it('every mapped interface and table exists', () => {
    const problems = CONTENT_TYPES.filter((m) => !declared.has(m.type)).map((m) => `${m.type}: interface not found in src/engage-types.ts`)
    expect(problems).toEqual([])
  })

  it('no declared key is missing from the schema', () => {
    const problems = reports.flatMap((r) => [
      ...r.phantoms.map((p) => `${r.type} (${r.table}): "${p}" is declared but is not a column, not stored elsewhere and not virtual`),
      ...r.brokenStorage.map((b) => `${r.type} (${r.table}): ${b}`),
    ])
    expect(problems).toEqual([])
  })

  it('every column of a content collection is declared on its type', () => {
    const problems = reports
      .filter((r) => r.kind === 'collection')
      .flatMap((r) => r.missing.map((c) => `${r.type} (${r.table}): column "${c}" is not declared`))
    expect(problems).toEqual([])
  })
})
