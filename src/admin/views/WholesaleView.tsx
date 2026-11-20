import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { WholesalePanel } from '@/features/ecommerce/components/WholesalePanel.nossr'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

/** /admin/shop/wholesale: wholesale applications and customer tags. Admin only. The panel carries the translated text. */
export async function WholesaleView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  return <WholesalePanel denied={!context.isAdmin} />
}

export default WholesaleView
