import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Ownership transfer and delegation (Task 22a).
 *   `eg_org_transfers`   two-step ownership transfer: only a SHA-256 of the confirmation token is stored.
 *   `eg_org_delegations` a member lets another account act for them in one company, with chosen rights, until a set time.
 * Mirror: `orgTransfers` and `orgDelegations` in src/cms/db/schema/organizations.ts. Idempotent.
 * Registered last in src/migrations/index.ts.
 */

export const ORG_TRANSFER_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS \`eg_org_transfers\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`organization_id\` text NOT NULL,
  \`from_user_id\` integer NOT NULL,
  \`to_user_id\` integer NOT NULL,
  \`token_hash\` text NOT NULL,
  \`status\` text NOT NULL,
  \`expires_at\` text NOT NULL,
  \`created_at\` text NOT NULL,
  \`resolved_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_org_delegations\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`organization_id\` text NOT NULL,
  \`delegator_id\` integer NOT NULL,
  \`delegate_id\` integer NOT NULL,
  \`permissions\` text NOT NULL,
  \`expires_at\` text NOT NULL,
  \`created_at\` text NOT NULL,
  \`revoked_at\` text
)`,
]

export const ORG_TRANSFER_INDEXES: string[] = [
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_org_transfers_token_idx` ON `eg_org_transfers` (`token_hash`)',
  'CREATE INDEX IF NOT EXISTS `eg_org_transfers_org_idx` ON `eg_org_transfers` (`organization_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_org_delegations_org_idx` ON `eg_org_delegations` (`organization_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_org_delegations_delegate_idx` ON `eg_org_delegations` (`delegate_id`)',
]

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  for (const statement of [...ORG_TRANSFER_TABLES, ...ORG_TRANSFER_INDEXES]) {
    await db.run(sql.raw(statement))
  }
  engine.logger.info('[migrate] Ownership transfer and delegation tables are present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the transfer and delegation tables are left in place.')
}
