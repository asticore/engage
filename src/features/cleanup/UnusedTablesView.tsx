import React from 'react'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { getAdminUi } from '@/admin/i18n/serverUi'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

import { getCleanupDb } from './guard'
import { formatBytes } from './size'
import { UnusedTablesPanel } from './UnusedTablesPanel'
import { listUnusedTables } from './unusedTables'

const rootClassName =
  'flex flex-col gap-[calc(var(--base)*1.5)] px-[var(--gutter-h)] pt-[calc(var(--base)*1.5)] pb-[calc(var(--base)*3)] max-w-[1100px]'
const mutedClassName = 'mt-[calc(var(--base)*0.25)] mx-0 mb-0 text-[var(--theme-elevation-600)]'

/**
 * Settings > Data and System > Unused tables. Super admin only (the admin role is
 * the highest there is): anyone else is sent to the dashboard.
 */
export const UnusedTablesView: React.FC = async () => {
  const context = await getAdminContext()
  if (!context.isAdmin) redirect(adminHref('', await getAdminRoot()))

  const { t } = await getAdminUi()
  const db = await getCleanupDb()
  const report = db ? await listUnusedTables(db, await getFeatureFlags()) : null
  const total = report?.tables.reduce((sum, entry) => sum + entry.bytes, 0) ?? 0

  return (
    <div className={rootClassName}>
      <header>
        <h1 className="m-0">{t('ut.title')}</h1>
        <p className={mutedClassName}>{t('ut.intro')}</p>
        {report && report.tables.length > 0 && (
          <p className={mutedClassName}>
            {t('ut.summary', { count: report.tables.length, size: `${report.sizesAreExact ? '' : '~'}${formatBytes(total)}` })}
            {report.sizesAreExact ? '' : ` ${t('ut.sizeEstimated')}`}
          </p>
        )}
      </header>
      {report ? <UnusedTablesPanel estimated={!report.sizesAreExact} tables={report.tables} /> : <p className={mutedClassName}>{t('ut.refused.no-database')}</p>}
    </div>
  )
}
