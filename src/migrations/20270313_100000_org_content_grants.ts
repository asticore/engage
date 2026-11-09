import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Company content access: `eg_content_org_grants` lets a company's admins narrow a document that
 * is already limited to the company (`eg_content_org_visibility`) to chosen members or teams.
 * A document with no grant rows stays visible to every member of the company, as before.
 *
 * Mirror: `contentOrgGrants` in src/cms/db/schema/organizations.ts. Idempotent. Registered last in src/migrations/index.ts.
 */

export const ORG_GRANT_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS \`eg_content_org_grants\` (
  \`organization_id\` text NOT NULL,
  \`collection\` text NOT NULL,
  \`doc_id\` integer NOT NULL,
  \`subject_type\` text NOT NULL,
  \`subject_id\` text NOT NULL,
  \`created_at\` text NOT NULL,
  PRIMARY KEY (\`organization_id\`, \`collection\`, \`doc_id\`, \`subject_type\`, \`subject_id\`)
)`,
]

export const ORG_GRANT_INDEXES: string[] = ['CREATE INDEX IF NOT EXISTS `eg_content_org_grants_doc_idx` ON `eg_content_org_grants` (`collection`, `doc_id`)']

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  for (const statement of [...ORG_GRANT_TABLES, ...ORG_GRANT_INDEXES]) {
    await db.run(sql.raw(statement))
  }
  engine.logger.info('[migrate] Company content grants table is present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the company content grants table is left in place.')
}
