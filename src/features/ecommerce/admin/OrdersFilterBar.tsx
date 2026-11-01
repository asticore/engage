'use client'

import type { ListFilter, ListState } from '@/admin/list/listQuery'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { ORDER_STATUS_LABELS, type OrderStatus } from '../lib/orderStatus'
import { EMPTY_ORDER_PICKS, PAYMENT_CHOICES, STATUS_CHOICES, applyOrderPicks, readOrderPicks, type OrderPicks, type PaymentChoice } from '../lib/orderFilters'
import './orders-filter-bar.css'
import { Tooltip } from '@/components/admin/shared/Tooltip'

/** Status, payment and date-range filters for the orders list. Every change goes straight to the list. */
export function OrdersFilterBar({ state, onChange }: { state: ListState; onChange: (filters: ListFilter[]) => void }) {
  const t = useAdminT()
  const picks = readOrderPicks(state.filters)
  const update = (patch: Partial<OrderPicks>) => onChange(applyOrderPicks(state.filters, { ...picks, ...patch }))
  const anyPick = picks.status !== '' || picks.payment !== 'any' || picks.from !== '' || picks.to !== ''

  return (
    <div className="orders-filter-bar" role="group" aria-label={t('orders.filter.group')}>
      <Tooltip text={t('orders.filter.statusTip')}><label>
        <span>{t('orders.filter.status')}</span>
        <select value={picks.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">{t('orders.filter.anyStatus')}</option>
          {STATUS_CHOICES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value as OrderStatus]}
            </option>
          ))}
        </select>
      </label></Tooltip>
      <Tooltip text={PAYMENT_CHOICES.find((c) => c.value === picks.payment)?.tooltip}><label>
        <span>{t('orders.filter.payment')}</span>
        <select value={picks.payment} onChange={(e) => update({ payment: e.target.value as PaymentChoice })}>
          {PAYMENT_CHOICES.map((choice) => (
            <option key={choice.value} value={choice.value} title={choice.tooltip}>
              {choice.label}
            </option>
          ))}
        </select>
      </label></Tooltip>
      <Tooltip text={t('orders.filter.fromTip')}><label>
        <span>{t('orders.filter.placedFrom')}</span>
        <input type="date" value={picks.from} onChange={(e) => update({ from: e.target.value })} />
      </label></Tooltip>
      <Tooltip text={t('orders.filter.toTip')}><label>
        <span>{t('orders.filter.placedTo')}</span>
        <input type="date" value={picks.to} onChange={(e) => update({ to: e.target.value })} />
      </label></Tooltip>
      {anyPick && (
        <Tooltip text={t('orders.filter.clearTip')}><button type="button" className="orders-filter-clear" onClick={() => onChange(applyOrderPicks(state.filters, EMPTY_ORDER_PICKS))}>
          {t('orders.filter.clearLabel')}
        </button></Tooltip>
      )}
    </div>
  )
}
