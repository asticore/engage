'use client'

import React, { useEffect, useState } from 'react'

import '@/features/shopReports/shop-reports.css'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'

type ProductOption = { id: number; title: string; price: number | null }
type Loaded = { currency: string; maxTiers: number; products: ProductOption[]; tiers: ApiTier[] }
type ApiTier = { productId: string; variationId: string | null; customerType: string | null; minQty: number; price: number }
type Draft = { minQty: string; customerType: string; variationId: string; price: string }
type Rule = { minQty: string; customerType: string; percentOff: string }

const API = '/api/admin-price-tiers'
const toDraft = (t: ApiTier): Draft => ({ minQty: String(t.minQty), customerType: t.customerType ?? '', variationId: t.variationId ?? '', price: String(t.price) })

const post = async (body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> => {
  const res = await fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}

/** Price tiers: prices by quantity and by customer type, per product, plus a bulk percentage setter. */
export function PriceTiersPanel() {
  const t = useAdminT()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [productId, setProductId] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [rules, setRules] = useState<Rule[]>([{ minQty: '10', customerType: '', percentOff: '10' }])
  const [scopeAll, setScopeAll] = useState(true)

  const load = (id: string) =>
    fetch(`${API}${id ? `?productId=${encodeURIComponent(id)}` : ''}`, { credentials: 'include' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Loaded & { error?: string }
        if (!res.ok || body.error) return setError(body.error || t('shop.tiers.loadError'))
        setLoaded(body)
        setDrafts(body.tiers.map(toDraft))
        setError('')
      })
      .catch(() => setError(t('shop.tiers.loadError')))

  useEffect(() => {
    void load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (id: string) => {
    setProductId(id)
    setMessage('')
    setDrafts([])
    if (id) void load(id)
  }
  const updateDraft = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  const updateRule = (i: number, patch: Partial<Rule>) => setRules((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))

  const save = async () => {
    setBusy(true)
    setMessage('')
    try {
      const { ok, data } = await post({ productId, tiers: drafts.map((d) => ({ minQty: d.minQty, customerType: d.customerType, variationId: d.variationId, price: d.price })) })
      setMessage(ok ? t('shop.tiers.saved') : String(data.error || t('shop.tiers.saveError')))
      if (ok) setDrafts(((data.tiers as ApiTier[]) ?? []).map(toDraft))
    } finally {
      setBusy(false)
    }
  }

  const bulk = async () => {
    setBusy(true)
    setMessage('')
    try {
      const scope = scopeAll ? 'all' : productId ? [productId] : []
      const { ok, data } = await post({ action: 'bulk', scope, rules })
      setMessage(ok ? t('shop.tiers.bulkDone', { count: String(data.changed ?? 0) }) : String(data.error || t('shop.tiers.saveError')))
      if (ok && productId) void load(productId)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="shop-reports__error">{error}</p>
  if (!loaded) return <p>{t('shop.tiers.loading')}</p>
  const product = loaded.products.find((p) => String(p.id) === productId)

  return (
    <div className="field-type" style={{ display: 'grid', gap: 16 }}>
      <p>{t('shop.tiers.intro', { currency: loaded.currency })}</p>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>{t('shop.tiers.product')}</span>
        <select value={productId} onChange={(e) => choose(e.target.value)}>
          <option value="">{t('shop.tiers.pickProduct')}</option>
          {loaded.products.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.title}
            </option>
          ))}
        </select>
      </label>

      {productId ? (
        <section style={{ display: 'grid', gap: 12 }}>
          <p>{product?.price != null ? t('shop.tiers.normalPrice', { price: `${product.price.toFixed(2)} ${loaded.currency}` }) : t('shop.tiers.noPrice')}</p>
          {drafts.length === 0 ? <p>{t('shop.tiers.noTiers')}</p> : null}
          {drafts.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>{t('shop.tiers.qtyFrom')}</span>
                <input type="number" min="1" step="1" value={d.minQty} onChange={(e) => updateDraft(i, { minQty: e.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>{t('shop.tiers.customerType')}</span>
                <input type="text" maxLength={60} value={d.customerType} placeholder={t('shop.tiers.everyone')} onChange={(e) => updateDraft(i, { customerType: e.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>{t('shop.tiers.variationId')}</span>
                <input type="text" value={d.variationId} placeholder={t('shop.tiers.allVariations')} onChange={(e) => updateDraft(i, { variationId: e.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>{t('shop.tiers.priceEach', { currency: loaded.currency })}</span>
                <input type="number" min="0" step="0.01" value={d.price} onChange={(e) => updateDraft(i, { price: e.target.value })} />
              </label>
              <button type="button" onClick={() => setDrafts((rows) => rows.filter((_, j) => j !== i))}>
                {t('shop.tiers.remove')}
              </button>
            </div>
          ))}
          <p className="shop-reports__range">{t('shop.tiers.customerTypeHelp')}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={drafts.length >= loaded.maxTiers} onClick={() => setDrafts((d) => [...d, { minQty: '10', customerType: '', variationId: '', price: product?.price != null ? String(product.price) : '' }])}>
              {t('shop.tiers.addTier')}
            </button>
            <button type="button" onClick={save} disabled={busy}>
              {t('shop.tiers.save')}
            </button>
          </div>
        </section>
      ) : null}

      <section style={{ display: 'grid', gap: 12, borderTop: '1px solid var(--theme-elevation-150, #ddd)', paddingTop: 12 }}>
        <h2>{t('shop.tiers.bulkTitle')}</h2>
        <p>{t('shop.tiers.bulkHelp')}</p>
        {rules.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>{t('shop.tiers.qtyFrom')}</span>
              <input type="number" min="1" step="1" value={r.minQty} onChange={(e) => updateRule(i, { minQty: e.target.value })} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>{t('shop.tiers.customerType')}</span>
              <input type="text" maxLength={60} value={r.customerType} placeholder={t('shop.tiers.everyone')} onChange={(e) => updateRule(i, { customerType: e.target.value })} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>{t('shop.tiers.percentOff')}</span>
              <input type="number" min="1" max="99" step="1" value={r.percentOff} onChange={(e) => updateRule(i, { percentOff: e.target.value })} />
            </label>
            <button type="button" disabled={rules.length === 1} onClick={() => setRules((rows) => rows.filter((_, j) => j !== i))}>
              {t('shop.tiers.remove')}
            </button>
          </div>
        ))}
        <label>
          <input type="checkbox" checked={scopeAll} onChange={(e) => setScopeAll(e.target.checked)} /> {t('shop.tiers.bulkScopeAll')}
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setRules((r) => [...r, { minQty: '50', customerType: '', percentOff: '15' }])}>
            {t('shop.tiers.addRule')}
          </button>
          <button type="button" onClick={bulk} disabled={busy || (!scopeAll && !productId)}>
            {t('shop.tiers.applyBulk')}
          </button>
        </div>
      </section>
      {message ? <p role="status">{message}</p> : null}
    </div>
  )
}
