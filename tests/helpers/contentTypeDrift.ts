// Compares the content types in src/engage-types.ts (hand-written interfaces the app reads) with the
// generated database schema in src/cms/db/schema, which is the source of truth for what a collection or global
// stores. Used by tests/int/content-types-drift.int.spec.ts; keep the rules here, the spec only asserts them.
import fs from 'node:fs'

import { getTableColumns, getTableName, is } from 'drizzle-orm'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as ts from 'typescript'

import * as schema from '@/cms/db/schema'

export type MappedType = { type: string; table: string; kind: 'collection' | 'global' }

/** Interface name in engage-types.ts -> schema table export name. Engine internals and vendor types are not mapped. */
export const CONTENT_TYPES: MappedType[] = [
  { type: 'Post', table: 'posts', kind: 'collection' },
  { type: 'Page', table: 'pages', kind: 'collection' },
  { type: 'Product', table: 'products', kind: 'collection' },
  { type: 'Event', table: 'events', kind: 'collection' },
  { type: 'User', table: 'users', kind: 'collection' },
  { type: 'Media', table: 'media', kind: 'collection' },
  { type: 'Faq', table: 'faqs', kind: 'collection' },
  { type: 'PageTemplate', table: 'pageTemplates', kind: 'collection' },
  { type: 'Form', table: 'forms', kind: 'collection' },
  { type: 'FormSubmission', table: 'formSubmissions', kind: 'collection' },
  { type: 'FieldGroup', table: 'fieldGroups', kind: 'collection' },
  { type: 'EventRsvp', table: 'eventRSVPs', kind: 'collection' },
  { type: 'Course', table: 'courses', kind: 'collection' },
  { type: 'Lesson', table: 'lessons', kind: 'collection' },
  { type: 'Enrolment', table: 'enrolments', kind: 'collection' },
  { type: 'LessonProgress', table: 'lessonProgress', kind: 'collection' },
  { type: 'Membership', table: 'memberships', kind: 'collection' },
  { type: 'MembershipTier', table: 'membershipTiers', kind: 'collection' },
  { type: 'Translation', table: 'translations', kind: 'collection' },
  { type: 'Backup', table: 'backups', kind: 'collection' },
  { type: 'AuditLog', table: 'auditLog', kind: 'collection' },
  { type: 'AbTest', table: 'abTests', kind: 'collection' },
  { type: 'Header', table: 'header', kind: 'global' },
  { type: 'Footer', table: 'footer', kind: 'global' },
  { type: 'SiteSetting', table: 'siteSettings', kind: 'global' },
  { type: 'Integration', table: 'integrations', kind: 'global' },
  { type: 'BlogSetting', table: 'blogSettings', kind: 'global' },
  { type: 'ShopSetting', table: 'shopSettings', kind: 'global' },
  { type: 'SeoSetting', table: 'seoSettings', kind: 'global' },
  { type: 'SpeedSetting', table: 'speedSettings', kind: 'global' },
  { type: 'MediaSetting', table: 'mediaSettings', kind: 'global' },
  { type: 'BackupSetting', table: 'backupSettings', kind: 'global' },
  { type: 'LanguageSetting', table: 'languageSettings', kind: 'global' },
  { type: 'MemberSetting', table: 'memberSettings', kind: 'global' },
  { type: 'SecuritySetting', table: 'securitySettings', kind: 'global' },
  { type: 'EmailSetting', table: 'emailSettings', kind: 'global' },
  { type: 'PaymentSetting', table: 'paymentSettings', kind: 'global' },
  { type: 'FormSetting', table: 'formSettings', kind: 'global' },
  { type: 'FaqSetting', table: 'faqSettings', kind: 'global' },
]

/**
 * A declared key that is stored in a related table, not a column of this table. The value is the schema export
 * that holds it (a table, or an object of block tables); the test checks that export exists.
 */
export const STORED_ELSEWHERE: Record<string, Record<string, string>> = {
  Post: { categories: 'postsCategories', tags: 'postsRels', layout: 'postsBlocks' },
  Page: { blocks: 'pagesBlocks' },
  Product: { images: 'productsRels', faqs: 'productsRels', layout: 'productsBlocks' },
  User: { roles: 'usersRoles', sessions: 'usersSessions' },
  PageTemplate: { blocks: 'pageTemplatesBlocks' },
  Form: { fields: 'formsFields' },
  FieldGroup: { fields: 'fieldGroupsFields', targetCollections: 'fieldGroupsTargetCollections' },
  Lesson: { content: 'lessonsContentBlocks', resources: 'lessonsResources' },
  MembershipTier: { benefits: 'membershipTiersBenefits' },
  AbTest: { variants: 'abTestsVariants', goals: 'abTestsGoals' },
  Header: { menu: 'headerMenu', socialsLinks: 'headerSocialsLinks' },
  Footer: { columns: 'footerColumns', socialsLinks: 'footerSocialsLinks' },
  BlogSetting: { introBlocks: 'blogSettingsBlocks' },
  ShopSetting: { introBlocks: 'shopSettingsBlocks' },
  FaqSetting: { introBlocks: 'faqSettingsBlocks' },
  SeoSetting: { schemaSameAs: 'seoSettingsSchemaSameAs' },
  SpeedSetting: { advancedPreconnectOrigins: 'speedSettingsAdvancedPreconnectOrigins', advancedPrefetchDns: 'speedSettingsAdvancedPrefetchDns' },
  MediaSetting: { resizingResponsiveWidths: 'mediaSettingsResizingResponsiveWidths' },
  LanguageSetting: { multilingualActiveLocales: 'languageSettingsMultilingualActiveLocales' },
}

/**
 * A declared key that has no column and is never stored: computed when read or write-only input. Each needs a
 * reason. Only add one when the key is not stored under another name.
 */
export const VIRTUAL: Record<string, Record<string, string>> = {
  Event: {
    rsvpsDocs: 'populated RSVP list added when an event is read (join field), not a column',
    rsvpsHasNextPage: 'paging flag of the populated RSVP list (join field), not a column',
    rsvpsTotalDocs: 'total of the populated RSVP list (join field), not a column',
  },
  Course: {
    lessonsDocs: 'populated lesson list added when a course is read (join field), not a column',
    lessonsHasNextPage: 'paging flag of the populated lesson list (join field), not a column',
    lessonsTotalDocs: 'total of the populated lesson list (join field), not a column',
  },
  User: {
    password: 'write-only input when a password is set; stored as the salt and hash columns, never read back',
  },
}

/** Columns a collection's interface leaves out on purpose. Empty by default: add an entry only with a reason. */
export const UNDECLARED: Record<string, Record<string, string>> = {}

export type SchemaTable = { sqlName: string; columns: Record<string, { dataType: string; notNull: boolean; sqlName: string }> }

/** Every table in the schema by its export name, plus the names of object exports (block-table maps). */
export function loadSchema() {
  const tables = new Map<string, SchemaTable>()
  const exportNames = new Set<string>()
  for (const [name, value] of Object.entries(schema)) {
    exportNames.add(name)
    if (is(value, SQLiteTable)) {
      const columns: SchemaTable['columns'] = {}
      for (const [key, col] of Object.entries(getTableColumns(value))) {
        const c = col as unknown as { dataType: string; notNull: boolean; name: string }
        columns[key] = { dataType: c.dataType, notNull: c.notNull, sqlName: c.name }
      }
      tables.set(name, { sqlName: getTableName(value), columns })
    }
  }
  return { tables, exportNames }
}

export type Declared = { flat: string; group: string | null; optional: boolean; typeText: string }

const propName = (m: ts.PropertySignature) =>
  m.name && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) ? m.name.text : '?'

/**
 * Reads each interface's property names from engage-types.ts. A nested object type is flattened to
 * `group + Cap(child)`, the name the schema gives its column, unless that name is itself a column (a rich-text
 * JSON column such as `answer`, which the interface models as an object).
 */
export function loadDeclared(file: string, columnsOf: (iface: string) => Set<string>): Map<string, Declared[]> {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true)
  const result = new Map<string, Declared[]>()
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  ts.forEachChild(sf, (node) => {
    if (!ts.isInterfaceDeclaration(node)) return
    const cols = columnsOf(node.name.text)
    const out: Declared[] = []
    const walk = (members: ts.NodeArray<ts.TypeElement>, prefix: string | null, group: string | null) => {
      for (const m of members) {
        if (!ts.isPropertySignature(m)) continue
        const name = propName(m)
        const flat = prefix ? prefix + cap(name) : name
        const optional = !!m.questionToken
        if (m.type && ts.isTypeLiteralNode(m.type) && !cols.has(flat)) {
          walk(m.type.members, flat, group ?? name)
        } else {
          out.push({ flat, group, optional, typeText: m.type ? m.type.getText(sf) : 'any' })
        }
      }
    }
    walk(node.members, null, null)
    result.set(node.name.text, out)
  })
  return result
}

export type DriftReport = {
  type: string
  table: string
  kind: 'collection' | 'global'
  /** Declared keys with no column and no explanation. */
  phantoms: string[]
  /** Declared keys that point at a schema export that does not exist. */
  brokenStorage: string[]
  /** Schema columns the type does not declare (collections must have none). */
  missing: string[]
}

/** Compares one mapped type with its table. */
export function compareType(map: MappedType, declaredList: Declared[], table: SchemaTable | undefined, exportNames: Set<string>): DriftReport {
  const report: DriftReport = { type: map.type, table: map.table, kind: map.kind, phantoms: [], brokenStorage: [], missing: [] }
  if (!table) {
    report.brokenStorage.push(`table export "${map.table}" does not exist`)
    return report
  }
  const columnNames = new Set(Object.keys(table.columns))
  const declaredNames = new Set(declaredList.map((d) => d.flat))
  for (const d of declaredList) {
    if (columnNames.has(d.flat)) continue
    const stored = STORED_ELSEWHERE[map.type]?.[d.flat]
    if (stored) {
      if (!exportNames.has(stored)) report.brokenStorage.push(`${d.flat} says it is stored in "${stored}", which the schema does not export`)
      continue
    }
    if (VIRTUAL[map.type]?.[d.flat]) continue
    report.phantoms.push(d.flat)
  }
  for (const col of columnNames) {
    if (declaredNames.has(col)) continue
    if (UNDECLARED[map.type]?.[col]) continue
    report.missing.push(col)
  }
  return report
}
