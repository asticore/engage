'use client'

import React, { useContext, useEffect, useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import { STYLE_PRESETS } from '@/features/forms/config'
import { FEED_FIELDS, NO_REQUEST_FEED, type FeedField } from '@/features/forms/requestFeed'
import { CUSTOMER_FIELDS, NO_CHECKOUT, type CustomerField } from '@/features/forms/checkoutHandoff'
import { WebhookDeliveryLog, WebhookTestButton } from './FormWebhookTools'
import { FormEditorContext } from './formInputs'
import { SharedListsCard } from './SharedListsCard'
import type { FormConfig, FormNotificationRule, FormStylePreset, FormWebhook } from '@/features/forms/types'

/**
 * The "Form" tab of the editor dock: everything about the form that is not a
 * field. Writes into one `formConfig` object (see features/forms/config.ts);
 * the server normalises it again on save, so nothing here is trusted either.
 */

type Props = {
  config: FormConfig
  onChange: (next: FormConfig) => void
  formId: string | undefined
  embedKey: string | undefined
  formStatus: 'draft' | 'published'
  hasUnpublishedChanges: boolean
  isAdmin: boolean
  busy: boolean
  onPublish: () => void
  onUnpublish: () => void
}

const Section: React.FC<{ title: string; children: React.ReactNode; open?: boolean }> = ({ title, children, open }) => (
  <details className="ve-form-section" open={open}>
    <summary>{title}</summary>
    <div className="ve-section-fields">{children}</div>
  </details>
)

const uid = (): string => `x${Math.random().toString(36).slice(2, 8)}`

export const FormSettingsPanel: React.FC<Props> = ({ config, onChange, formId, embedKey, formStatus, hasUnpublishedChanges, isAdmin, busy, onPublish, onUnpublish }) => {
  const t = useAdminT()
  const { fields: fieldChoices } = useContext(FormEditorContext)
  const [products, setProducts] = useState<{ id: number; title: string }[]>([])
  useEffect(() => {
    if (!(config.checkout || NO_CHECKOUT).enabled && !(config.requestFeed || NO_REQUEST_FEED).enabled) return
    let live = true
    fetch('/api/products?limit=500&depth=0&sort=title', { credentials: 'include' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { docs?: { id: number; title?: string }[] }
        if (live) setProducts((body.docs ?? []).filter((p) => Number.isInteger(Number(p.id))).map((p) => ({ id: Number(p.id), title: p.title || `Product ${p.id}` })))
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
  }, [config.checkout, config.requestFeed])
  /** A field name picked from this form's fields; a name typed earlier that no longer matches stays selectable. */
  const fieldSelect = (value: string, onPick: (name: string) => void) => (
    <select value={value} onChange={(event) => onPick(event.target.value)}>
      <option value="">None</option>
      {value && !fieldChoices.some((f) => f.name === value) ? <option value={value}>{value}</option> : null}
      {fieldChoices.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
    </select>
  )
  const set = <K extends keyof FormConfig>(key: K, value: FormConfig[K]) => onChange({ ...config, [key]: value })
  const style = config.style || {}
  const steps = config.steps || {}
  const success = config.success || {}
  const rules = config.notifications || []
  const hooks = config.webhooks || []
  const key = embedKey || formId || ''
  const checkout = config.checkout || NO_CHECKOUT
  const setCheckout = (patch: Partial<typeof NO_CHECKOUT>) => set('checkout', { ...checkout, ...patch })
  const feed = config.requestFeed || NO_REQUEST_FEED
  const setFeed = (patch: Partial<typeof NO_REQUEST_FEED>) => set('requestFeed', { ...feed, ...patch })
  const setFeedMap = (field: FeedField, name: string) => setFeed({ map: { ...feed.map, [field]: name } })
  const setMap = (field: CustomerField, name: string) => setCheckout({ map: { ...checkout.map, [field]: name } })

  const setRule = (index: number, patch: Partial<FormNotificationRule>) => set('notifications', rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
  const setHook = (index: number, patch: Partial<FormWebhook>) => set('webhooks', hooks.map((hook, i) => (i === index ? { ...hook, ...patch } : hook)))

  return (
    <div className="ve-panel ve-form-settings">
      <div className="ve-panel__body">
        <Section title={t('ve.form.sectionStatus')} open>
          <p className="ve-panel__hint">
            This form is <strong>{formStatus === 'published' ? 'published' : 'a draft'}</strong>.
            {formStatus === 'published' && hasUnpublishedChanges ? t('ve.fsp.unpubChanges') : ''}
          </p>
          <div className="ve-col-row">
            <button type="button" className="ve-btn ve-btn--primary" onClick={onPublish} disabled={busy}>
              {formStatus === 'published' ? t('ve.form.publishChanges') : t('ve.form.publish')}
            </button>
            {formStatus === 'published' && (
              <button type="button" className="ve-btn ve-btn--ghost" onClick={onUnpublish} disabled={busy}>
                Unpublish
              </button>
            )}
          </div>
        </Section>

        <Section title={t('ve.form.sectionLook')}>
          <label className="ve-field ve-field--full">
            <span>{t('ve.fsp.style')}</span>
            <select value={style.preset || 'theme'} onChange={(event) => set('style', { ...style, preset: event.target.value as FormStylePreset })}>
              {STYLE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label} - {preset.description}
                </option>
              ))}
            </select>
          </label>
          <label className="ve-field ve-field--full">
            <span>{t('ve.fsp.accent')}</span>
            <input type="text" placeholder="#2e3192" value={style.accent || ''} onChange={(event) => set('style', { ...style, accent: event.target.value })} />
          </label>
          <label className="ve-field ve-field--full">
            <span>{t('ve.fsp.customCss')}</span>
            <textarea rows={6} spellCheck={false} value={style.customCss || ''} onChange={(event) => set('style', { ...style, customCss: event.target.value })} />
            <span className="ve-field__help">{t('ve.fsp.customCssHelp')}</span>
          </label>
        </Section>

        <Section title={t('ve.form.sectionSteps')}>
          <p className="ve-panel__hint">{t('ve.fsp.stepHint')}</p>
          <label className="ve-field ve-field--checkbox">
            <input type="checkbox" checked={steps.showProgress !== false} onChange={(event) => set('steps', { ...steps, showProgress: event.target.checked })} />
            <span>{t('ve.fsp.showProgress')}</span>
          </label>
          <label className="ve-field ve-field--full">
            <span>{t('ve.fsp.progressStyle')}</span>
            <select value={steps.progressStyle || 'bar'} onChange={(event) => set('steps', { ...steps, progressStyle: event.target.value as 'bar' | 'steps' | 'text' })}>
              <option value="bar">{t('ve.fsp.progBar')}</option>
              <option value="steps">{t('ve.fsp.progSteps')}</option>
              <option value="text">{t('ve.fsp.progText')}</option>
            </select>
          </label>
          <div className="ve-col-row">
            <input type="text" aria-label={t('ve.form.nextLabel')} placeholder={t('ve.form.next')} value={steps.nextLabel || ''} onChange={(event) => set('steps', { ...steps, nextLabel: event.target.value })} />
            <input type="text" aria-label={t('ve.form.backLabel')} placeholder={t('ve.form.back')} value={steps.backLabel || ''} onChange={(event) => set('steps', { ...steps, backLabel: event.target.value })} />
          </div>
        </Section>

        <Section title={t('ve.form.sectionAfter')}>
          <label className="ve-field ve-field--full">
            <span>{t('ve.fsp.whatHappens')}</span>
            <select value={success.mode || 'message'} onChange={(event) => set('success', { ...success, mode: event.target.value as 'message' | 'redirect' })}>
              <option value="message">{t('ve.fsp.showMessage')}</option>
              <option value="redirect">{t('ve.fsp.goRedirect')}</option>
            </select>
          </label>
          {success.mode === 'redirect' ? (
            <label className="ve-field ve-field--full">
              <span>{t('ve.fsp.redirectAddr')}</span>
              <input type="text" placeholder="/thank-you" value={success.redirectUrl || ''} onChange={(event) => set('success', { ...success, redirectUrl: event.target.value })} />
            </label>
          ) : (
            <label className="ve-field ve-field--full">
              <span>{t('ve.fsp.messageLabel')}</span>
              <textarea rows={3} value={success.message || ''} onChange={(event) => set('success', { ...success, message: event.target.value })} />
            </label>
          )}
        </Section>

        <Section title="Go to checkout">
          <label className="ve-field ve-field--checkbox">
            <input type="checkbox" checked={checkout.enabled} onChange={(event) => setCheckout({ enabled: event.target.checked })} />
            <span>After sending, take the visitor to the checkout with a product in the cart</span>
          </label>
          {checkout.enabled ? (
            <>
              <p className="ve-panel__hint">This replaces the thank you message or address above. The entry is still saved first.</p>
              <label className="ve-field ve-field--full">
                <span>Product</span>
                <select value={checkout.productId ?? ''} onChange={(event) => setCheckout({ productId: event.target.value === '' ? null : Number(event.target.value) })}>
                  <option value="">None</option>
                  {checkout.productId && !products.some((p) => p.id === checkout.productId) ? <option value={checkout.productId}>Product {checkout.productId}</option> : null}
                  {products.map((p) => <option key={p.id} value={p.id}>{p.title} (#{p.id})</option>)}
                </select>
              </label>
              <label className="ve-field ve-field--full">
                <span>Variation id (optional)</span>
                <input type="text" value={checkout.variationId} onChange={(event) => setCheckout({ variationId: event.target.value })} />
              </label>
              <label className="ve-field ve-field--full">
                <span>Quantity</span>
                <input type="number" min={1} value={checkout.quantity} onChange={(event) => setCheckout({ quantity: Number(event.target.value) || 1 })} />
              </label>
              <label className="ve-field ve-field--full">
                <span>Or choose the product from a field</span>
                {fieldSelect(checkout.choiceField, (name) => setCheckout({ choiceField: name }))}
                <span className="ve-field__help">A choice or dropdown field whose option values are product numbers, such as 12, or 12:variationId. It overrides the product above.</span>
              </label>
              <p className="ve-panel__hint">Fill the checkout from these fields (pick a field, or None to skip):</p>
              {CUSTOMER_FIELDS.map((field) => (
                <label className="ve-field ve-field--full" key={field}>
                  <span>{{ email: 'Email', name: 'Full name', phone: 'Phone', line1: 'Street address', city: 'Suburb or city', state: 'State', postcode: 'Postcode', country: 'Country (2 letter code)', note: 'Order note' }[field]}</span>
                  {fieldSelect(checkout.map[field] || '', (name) => setMap(field, name))}
                </label>
              ))}
            </>
          ) : null}
        </Section>

        <Section title="Send as a request">
          <label className="ve-field ve-field--checkbox">
            <input type="checkbox" checked={feed.enabled} onChange={(event) => setFeed({ enabled: event.target.checked })} />
            <span>Each entry also becomes a quote request, offer or item request</span>
          </label>
          {feed.enabled ? (
            <>
              <p className="ve-panel__hint">Needs Quotes and requests switched on in Site Settings. The entry is still saved, and the customer and the shop get the usual request emails.</p>
              <label className="ve-field ve-field--full">
                <span>Request type</span>
                <select value={feed.kind} onChange={(event) => setFeed({ kind: event.target.value as typeof feed.kind })}>
                  <option value="quote">Quote request</option>
                  <option value="bid">Offer (bid)</option>
                  <option value="item">Item request</option>
                </select>
              </label>
              <label className="ve-field ve-field--full">
                <span>Product (optional)</span>
                <select value={feed.productId ?? ''} onChange={(event) => setFeed({ productId: event.target.value === '' ? null : Number(event.target.value) })}>
                  <option value="">None</option>
                  {feed.productId && !products.some((p) => p.id === feed.productId) ? <option value={feed.productId}>Product {feed.productId}</option> : null}
                  {products.map((p) => <option key={p.id} value={p.id}>{p.title} (#{p.id})</option>)}
                </select>
              </label>
              <label className="ve-field ve-field--full">
                <span>Or choose the product from a field</span>
                {fieldSelect(feed.productField, (name) => setFeed({ productField: name }))}
                <span className="ve-field__help">A choice or dropdown field whose option values are product numbers, such as 12. It overrides the product above.</span>
              </label>
              <p className="ve-panel__hint">Fill the request from these fields (pick a field, or None to skip). Name and email are needed; details default to all the answers.</p>
              {FEED_FIELDS.map((field) => (
                <label className="ve-field ve-field--full" key={field}>
                  <span>{{ name: 'Name', email: 'Email', phone: 'Phone', quantity: 'Quantity', details: 'Details', deadline: 'Needed by (date)', offer: 'Offer amount (offers only)' }[field]}</span>
                  {fieldSelect(feed.map[field] || '', (name) => setFeedMap(field, name))}
                </label>
              ))}
            </>
          ) : null}
        </Section>

        <Section title={t('ve.form.sectionBehaviour')}>
          <label className="ve-field ve-field--full">
            <span>{t('ve.fsp.prefill')}</span>
            <input
              type="text"
              placeholder={t('ve.fsp.prefillPh')}
              value={(config.prefillKeys || []).join(', ')}
              onChange={(event) => set('prefillKeys', event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean))}
            />
            <span className="ve-field__help">{t('ve.fsp.prefillHelp')}</span>
          </label>
          <label className="ve-field ve-field--full">
            <span>{t('ve.fsp.retention')}</span>
            <input
              type="number"
              min={0}
              value={typeof config.retentionDays === 'number' ? config.retentionDays : ''}
              onChange={(event) => set('retentionDays', event.target.value === '' ? undefined : Number(event.target.value))}
            />
          </label>
        </Section>

        <Section title={t('ve.form.sectionNotifications')}>
          <p className="ve-panel__hint">{t('ve.fsp.notifyHint', { tags: '{{field name}}' })}</p>
          {rules.map((rule, index) => (
            <div className="ve-form-card" key={rule.id || index}>
              <label className="ve-field ve-field--checkbox">
                <input type="checkbox" checked={rule.enabled !== false} onChange={(event) => setRule(index, { enabled: event.target.checked })} />
                <span>{rule.name || `Notification ${index + 1}`}</span>
              </label>
              <input type="text" aria-label={t('ve.form.name')} placeholder={t('ve.form.name')} value={rule.name || ''} onChange={(event) => setRule(index, { name: event.target.value })} />
              <input type="text" aria-label={t('ve.form.sendToLabel')} placeholder={t('ve.form.sendTo')} value={rule.recipients || ''} onChange={(event) => setRule(index, { recipients: event.target.value })} />
              <input type="text" aria-label="Also send to (visible to everyone)" placeholder="Also send to (cc, visible to everyone)" value={rule.cc || ''} onChange={(event) => setRule(index, { cc: event.target.value })} />
              <input type="text" aria-label="Hidden copies" placeholder="Hidden copies (bcc, one message each)" value={rule.bcc || ''} onChange={(event) => setRule(index, { bcc: event.target.value })} />
              <label className="ve-field--checkbox">
                <input type="checkbox" checked={rule.replyToSubmitter !== false} onChange={(event) => setRule(index, { replyToSubmitter: event.target.checked })} />
                <span>Reply goes to the person who filled in the form</span>
              </label>
              <input type="text" aria-label={t('ve.form.subject')} placeholder={t('ve.form.subject')} value={rule.subject || ''} onChange={(event) => setRule(index, { subject: event.target.value })} />
              <textarea rows={3} aria-label={t('ve.form.message')} placeholder={t('ve.form.message')} value={rule.message || ''} onChange={(event) => setRule(index, { message: event.target.value })} />
              <div className="ve-col-row">
                <label className="ve-field--checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(rule.conditions?.enabled)}
                    onChange={(event) => setRule(index, { conditions: { ...(rule.conditions || { action: 'show', match: 'all', rules: [] }), enabled: event.target.checked } })}
                  />
                  <span>{t('ve.fsp.onlyWhen')}</span>
                </label>
                {rule.conditions?.enabled && (
                  <>
                    <input
                      type="text"
                      aria-label={t('ve.form.fieldName')}
                      placeholder={t('ve.fsp.fieldNamePh')}
                      value={rule.conditions.rules?.[0]?.field || ''}
                      onChange={(event) =>
                        setRule(index, { conditions: { ...rule.conditions, rules: [{ operator: 'equals', ...(rule.conditions?.rules?.[0] || {}), field: event.target.value }] } })
                      }
                    />
                    <span>{t('ve.fsp.is')}</span>
                    <input
                      type="text"
                      aria-label={t('ve.form.value')}
                      placeholder={t('ve.fsp.valuePh')}
                      value={rule.conditions.rules?.[0]?.value || ''}
                      onChange={(event) =>
                        setRule(index, { conditions: { ...rule.conditions, rules: [{ operator: 'equals', ...(rule.conditions?.rules?.[0] || {}), value: event.target.value }] } })
                      }
                    />
                  </>
                )}
              </div>
              <button type="button" className="ve-btn ve-btn--ghost" onClick={() => set('notifications', rules.filter((_, i) => i !== index))}>
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ve-btn ve-btn--ghost"
            disabled={rules.length >= 10}
            onClick={() => set('notifications', [...rules, { id: uid(), name: `Notification ${rules.length + 1}`, enabled: true, recipients: '', subject: 'New entry: {{form}}', message: '' }])}
          >
            + Add notification
          </button>
        </Section>

        {isAdmin && (
          <Section title={t('ve.form.sectionWebhooks')}>
            <p className="ve-panel__hint">{t('ve.fsp.webhookHint', { header: 'X-Engage-Signature' })}</p>
            {hooks.map((hook, index) => (
              <div className="ve-form-card" key={hook.id || index}>
                <label className="ve-field ve-field--checkbox">
                  <input type="checkbox" checked={hook.enabled !== false} onChange={(event) => setHook(index, { enabled: event.target.checked })} />
                  <span>{hook.name || `Webhook ${index + 1}`}</span>
                </label>
                <input type="text" aria-label={t('ve.form.name')} placeholder={t('ve.form.name')} value={hook.name || ''} onChange={(event) => setHook(index, { name: event.target.value })} />
                <input type="url" aria-label={t('ve.form.url')} placeholder="https://example.com/hook" value={hook.url || ''} onChange={(event) => setHook(index, { url: event.target.value })} />
                <input type="password" aria-label={t('ve.form.signingSecret')} placeholder={t('ve.form.signingSecret')} autoComplete="new-password" value={hook.secret || ''} onChange={(event) => setHook(index, { secret: event.target.value })} />
                <label className="ve-field">
                  <span>What to send</span>
                  <select value={hook.payload === 'chosen' ? 'chosen' : 'all'} onChange={(event) => setHook(index, { payload: event.target.value === 'chosen' ? 'chosen' : 'all' })}>
                    <option value="all">Every answer</option>
                    <option value="chosen">Only the fields I name</option>
                  </select>
                </label>
                {hook.payload === 'chosen' ? (
                  <input
                    type="text"
                    aria-label="Field names to send"
                    placeholder="Field names, separated by commas"
                    value={(hook.fields || []).join(', ')}
                    onChange={(event) => setHook(index, { fields: event.target.value.split(',').map((name) => name.trim()).filter(Boolean) })}
                  />
                ) : null}
                <label className="ve-field--checkbox">
                  <input type="checkbox" checked={hook.includeMeta === true} onChange={(event) => setHook(index, { includeMeta: event.target.checked })} />
                  <span>Include page address, consent record and status</span>
                </label>
                <input type="text" aria-label="Shared secret header name" placeholder="Optional header name, e.g. X-Api-Key" value={hook.headerName || ''} onChange={(event) => setHook(index, { headerName: event.target.value })} />
                <input type="password" aria-label="Shared secret header value" placeholder="Header value" autoComplete="new-password" value={hook.headerValue || ''} onChange={(event) => setHook(index, { headerValue: event.target.value })} />
                <WebhookTestButton formId={formId} webhookId={hook.id} />
                <button type="button" className="ve-btn ve-btn--ghost" onClick={() => set('webhooks', hooks.filter((_, i) => i !== index))}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="ve-btn ve-btn--ghost"
              disabled={hooks.length >= 5}
              onClick={() => set('webhooks', [...hooks, { id: uid(), name: `Webhook ${hooks.length + 1}`, enabled: true, url: '', secret: '' }])}
            >
              + Add webhook
            </button>
            <WebhookDeliveryLog formId={formId} />
          </Section>
        )}

        {isAdmin && (
          <Section title="Shared lists">
            <SharedListsCard />
          </Section>
        )}

        <Section title={t('ve.form.sectionEmbed')}>
          <p className="ve-panel__hint">{t('ve.fsp.embedsElsewhere')}</p>
          {key ? <p className="ve-panel__hint">{t('ve.form.embedPlace', { shortcode: `[form id="${key}"]` })}</p> : null}
        </Section>
      </div>
    </div>
  )
}
