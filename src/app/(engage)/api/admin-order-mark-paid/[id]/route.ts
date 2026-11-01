import { NextResponse } from 'next/server'

import { authorizeOrders, parseOrderId } from '@/features/ecommerce/server/adminOrder'
import { markOfflineOrderPaid } from '@/features/ecommerce/payments/offlineCheckout'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin-order-mark-paid/:id - staff have received the money for an order placed by bank transfer, cheque
 * or cash on delivery. Needs orders.update (or admin). Runs the same paid path as a card payment.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await authorizeOrders('update')
  if (!auth.ok) return auth.response
  const id = parseOrderId((await params).id)
  if (id === null) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const by = auth.user.email ?? 'staff'
  const result = await markOfflineOrderPaid(auth.engine, id, by)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
