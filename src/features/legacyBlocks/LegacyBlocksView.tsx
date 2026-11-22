import React from 'react'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

import { LegacyBlocksPanel } from './LegacyBlocksPanel.nossr'

const rootClassName =
  'flex flex-col gap-[calc(var(--base)*1.5)] px-[var(--gutter-h)] pt-[calc(var(--base)*1.5)] pb-[calc(var(--base)*3)] max-w-[1100px]'
const mutedClassName = 'mt-[calc(var(--base)*0.25)] mx-0 mb-0 text-[var(--theme-elevation-600)]'

/** Settings > Data and System > Legacy blocks. Admin only. */
export const LegacyBlocksView: React.FC = async () => {
  const context = await getAdminContext()
  if (!context.isAdmin) redirect(adminHref('', await getAdminRoot()))
  return (
    <div className={rootClassName}>
      <header>
        <h1 className="m-0">Legacy blocks</h1>
        <p className={mutedClassName}>
          Older pages can still hold the first-generation blocks (hero, call to action, image and text, gallery, rich text, table of contents, event grid, FAQ and product grid). This report counts them and converts them to the same editable sections and elements the visual builder uses.
        </p>
      </header>
      <LegacyBlocksPanel />
    </div>
  )
}
