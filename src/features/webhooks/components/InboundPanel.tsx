'use client'

import React, { useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import {
  deleteInboundAction,
  listInboundReceiptsAction,
  purgeLogsNowAction,
  rotateInboundSecretAction,
  saveInboundAction,
  saveRetentionAction,
  setInboundEnabledAction,
  type InboundData,
  type InboundView,
  type ReceiptView,
} from '../inboundActions'
import { EVENT_LABEL_KEYS, type WebhookEvent } from '../events'

/**
 * The inbound half of the webhooks screen: the log retention with a clean-up button, and the inbound
 * endpoints (create, edit, rotate the signing secret, on and off, delete, and the request log). Each
 * write is a server action that re-checks the session and the `webhooks` permission. The secret is
 * shown once, after create or rotate.
 */

type Draft = {
  id: number | null
  name: string
  description: string
  action: 'content' | 'event'
  collection: 'pages' | 'posts'
  titlePath: string
  status: 'draft' | 'published'
  event: WebhookEvent
  windowSeconds: number
  enabled: boolean
}

const blank = (defaultWindow: number): Draft => ({
  id: null,
  name: '',
  description: '',
  action: 'content',
  collection: 'pages',
  titlePath: 'title',
  status: 'draft',
  event: 'content.created',
  windowSeconds: defaultWindow,
  enabled: true,
})

const draftFrom = (e: InboundView): Draft => ({
  id: e.id,
  name: e.name,
  description: e.description,
  action: e.action,
  collection: e.collection === 'posts' ? 'posts' : 'pages',
  titlePath: e.titlePath,
  status: e.status,
  event: e.event ?? 'content.created',
  windowSeconds: e.windowSeconds,
  enabled: e.enabled,
})

export const RetentionPanel: React.FC<{ initial: InboundData }> = ({ initial }) => {
  const t = useAdminT()
  const [days, setDays] = useState(initial.retentionDays)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    const result = await saveRetentionAction(days)
    if (result.ok === false) return setError(result.error)
    setNotice(t('webhooks.retention.saved', { days: result.value!.retentionDays }))
  }

  const purge = async () => {
    if (!window.confirm(t('webhooks.retention.purgeConfirm', { days }))) return
    setError(null)
    const result = await purgeLogsNowAction()
    if (result.ok === false) return setError(result.error)
    setNotice(t('webhooks.retention.purged', { days: result.value!.days }))
  }

  return (
    <section aria-labelledby="webhook-retention-title" style={{ display: 'grid', gap: '0.75rem' }}>
      <h2 id="webhook-retention-title">{t('webhooks.retention.title')}</h2>
      <p>{t('webhooks.retention.help')}</p>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="status" style={{ color: 'var(--color-danger, #b00020)' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end' }}>
        <label>
          {t('webhooks.retention.label')}
          <select value={days} onChange={(ev) => setDays(Number(ev.target.value))}>
            {initial.retentionChoices.map((choice) => (
              <option key={choice} value={choice}>
                {t('webhooks.retention.option', { days: choice })}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={save}>
          {t('webhooks.retention.save')}
        </button>
        <button type="button" onClick={purge}>
          {t('webhooks.retention.purge')}
        </button>
      </div>
    </section>
  )
}

export const InboundPanel: React.FC<{ initial: InboundData }> = ({ initial }) => {
  const t = useAdminT()
  const [endpoints, setEndpoints] = useState<InboundView[]>(initial.endpoints)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [secret, setSecret] = useState<{ name: string; value: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [logId, setLogId] = useState<number | null>(null)
  const [receipts, setReceipts] = useState<ReceiptView[]>([])

  const fail = (text: string) => setNotice({ tone: 'error', text })
  const save = async () => {
    if (!draft) return
    const { id, ...input } = draft
    const result = await saveInboundAction(id, input)
    if (result.ok === false) return fail(result.error)
    const saved = result.value!
    setEndpoints((list) =>
      id === null
        ? [...list, saved.endpoint].sort((a, b) => a.name.localeCompare(b.name))
        : list.map((x) => (x.id === saved.endpoint.id ? saved.endpoint : x)),
    )
    if (saved.secret) setSecret({ name: saved.endpoint.name, value: saved.secret })
    setDraft(null)
    setNotice({ tone: 'ok', text: t('webhooks.inbound.saved') })
  }

  const rotate = async () => {
    if (!draft || draft.id === null) return
    if (!window.confirm(t('webhooks.inbound.secret.rotateConfirm'))) return
    const result = await rotateInboundSecretAction(draft.id)
    if (result.ok === false) return fail(result.error)
    setSecret({ name: draft.name, value: result.value!.secret })
    setNotice({ tone: 'ok', text: t('webhooks.inbound.secret.rotated') })
  }

  const flip = async (e: InboundView) => {
    const result = await setInboundEnabledAction(e.id, !e.enabled)
    if (result.ok === false) return fail(result.error)
    setEndpoints((list) => list.map((x) => (x.id === e.id ? result.value! : x)))
  }

  const remove = async (e: InboundView) => {
    if (!window.confirm(t('webhooks.inbound.deleteConfirm'))) return
    const result = await deleteInboundAction(e.id)
    if (result.ok === false) return fail(result.error)
    setEndpoints((list) => list.filter((x) => x.id !== e.id))
    if (logId === e.id) setLogId(null)
    setNotice({ tone: 'ok', text: t('webhooks.inbound.deleted') })
  }

  const showLog = async (e: InboundView) => {
    setLogId(e.id)
    const result = await listInboundReceiptsAction(e.id)
    setReceipts(result.ok ? (result.value ?? []) : [])
  }

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard?.writeText(address)
      setNotice({ tone: 'ok', text: t('webhooks.inbound.addressCopied') })
    } catch {
      fail(t('webhooks.inbound.addressCopyFailed'))
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  const outcomeLabel = (outcome: string) => t(`webhooks.inbound.outcome.${outcome}` as never)
  const eventLabel = (event: WebhookEvent) => t(EVENT_LABEL_KEYS[event] as never)
  const selected = endpoints.find((e) => e.id === logId) ?? null

  return (
    <section aria-labelledby="webhook-inbound-title" style={{ display: 'grid', gap: '1.25rem' }}>
      <h2 id="webhook-inbound-title">{t('webhooks.inbound.title')}</h2>
      <p>{t('webhooks.inbound.intro')}</p>
      {!initial.secretsReady && <p role="status">{t('webhooks.secretsOff')}</p>}
      {notice && (
        <p
          role="status"
          style={{ color: notice.tone === 'error' ? 'var(--color-danger, #b00020)' : 'inherit' }}
        >
          {notice.text}
        </p>
      )}

      {secret && (
        <section
          role="region"
          aria-label={t('webhooks.inbound.secret.title')}
          style={{
            display: 'grid',
            gap: '0.5rem',
            border: '1px solid currentColor',
            padding: '1rem',
            borderRadius: 6,
          }}
        >
          <strong>
            {t('webhooks.inbound.secret.title')}: {secret.name}
          </strong>
          <p>{t('webhooks.inbound.secret.once')}</p>
          <code style={{ wordBreak: 'break-all' }}>{secret.value}</code>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText(secret.value)
                  setCopied(true)
                } catch {
                  setCopied(false)
                }
              }}
            >
              {copied ? t('webhooks.secret.copied') : t('webhooks.secret.copy')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSecret(null)
                setCopied(false)
              }}
            >
              {t('webhooks.secret.done')}
            </button>
          </div>
        </section>
      )}

      {!draft && (
        <div>
          <button
            type="button"
            onClick={() => {
              setNotice(null)
              setDraft(blank(initial.limits.defaultWindow))
            }}
            disabled={!initial.secretsReady}
          >
            {t('webhooks.inbound.new')}
          </button>
        </div>
      )}

      {!draft &&
        (endpoints.length === 0 ? (
          <p>{t('webhooks.inbound.none')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t('webhooks.columns.name')}</th>
                <th scope="col">{t('webhooks.inbound.columns.address')}</th>
                <th scope="col">{t('webhooks.inbound.columns.does')}</th>
                <th scope="col">{t('webhooks.columns.enabled')}</th>
                <th scope="col">{t('webhooks.inbound.columns.last')}</th>
                <th scope="col">{t('webhooks.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>
                    <code style={{ wordBreak: 'break-all' }}>{e.address}</code>{' '}
                    <button type="button" onClick={() => copyAddress(e.address)}>
                      {t('webhooks.inbound.copyAddress')}
                    </button>
                  </td>
                  <td>
                    {e.action === 'event' && e.event
                      ? eventLabel(e.event)
                      : t('webhooks.inbound.createsItem', { collection: e.collection ?? '' })}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={e.enabled}
                      onChange={() => flip(e)}
                      aria-label={t('webhooks.enabledLabel')}
                    />
                  </td>
                  <td>
                    {e.last
                      ? `${outcomeLabel(e.last.outcome)} · ${new Date(e.last.at).toLocaleString()}`
                      : t('webhooks.last.none')}
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setNotice(null)
                        setDraft(draftFrom(e))
                      }}
                    >
                      {t('webhooks.edit')}
                    </button>
                    <button type="button" onClick={() => showLog(e)}>
                      {t('webhooks.inbound.log.open')}
                    </button>
                    <button type="button" onClick={() => remove(e)}>
                      {t('webhooks.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

      {selected && !draft && (
        <section
          aria-label={t('webhooks.inbound.log.title', { name: selected.name })}
          style={{ display: 'grid', gap: '0.5rem' }}
        >
          <h3>{t('webhooks.inbound.log.title', { name: selected.name })}</h3>
          {receipts.length === 0 ? (
            <p>{t('webhooks.inbound.log.none')}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('webhooks.inbound.log.when')}</th>
                  <th scope="col">{t('webhooks.inbound.log.key')}</th>
                  <th scope="col">{t('webhooks.inbound.log.outcome')}</th>
                  <th scope="col">{t('webhooks.inbound.log.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>{r.idempotencyKey ?? '-'}</td>
                    <td>{outcomeLabel(r.outcome)}</td>
                    <td>{r.reason ?? r.result ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {draft && (
        <form
          onSubmit={(ev) => {
            ev.preventDefault()
            void save()
          }}
          style={{ display: 'grid', gap: '1.25rem' }}
        >
          <fieldset style={{ display: 'grid', gap: '0.5rem' }}>
            <legend>{t('webhooks.inbound.section.basics')}</legend>
            <label>
              {t('webhooks.field.name')}
              <input
                value={draft.name}
                onChange={(ev) => set('name', ev.target.value)}
                maxLength={80}
                required
              />
            </label>
            <label>
              {t('webhooks.field.description')}
              <input
                value={draft.description}
                onChange={(ev) => set('description', ev.target.value)}
                maxLength={300}
              />
            </label>
            <label>
              {t('webhooks.inbound.field.action')}
              <select
                value={draft.action}
                onChange={(ev) => set('action', ev.target.value as Draft['action'])}
              >
                <option value="content">{t('webhooks.inbound.action.content')}</option>
                <option value="event">{t('webhooks.inbound.action.event')}</option>
              </select>
            </label>
          </fieldset>

          {draft.action === 'content' ? (
            <fieldset style={{ display: 'grid', gap: '0.5rem' }}>
              <legend>{t('webhooks.inbound.section.content')}</legend>
              <label>
                {t('webhooks.inbound.field.collection')}
                <select
                  value={draft.collection}
                  onChange={(ev) => set('collection', ev.target.value as Draft['collection'])}
                >
                  {initial.collections.map((c) => (
                    <option key={c} value={c}>
                      {t(`webhooks.inbound.collection.${c}` as never)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('webhooks.inbound.field.titlePath')}
                <input
                  value={draft.titlePath}
                  onChange={(ev) => set('titlePath', ev.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <p>{t('webhooks.inbound.titlePath.help')}</p>
              <label>
                {t('webhooks.inbound.field.status')}
                <select
                  value={draft.status}
                  onChange={(ev) => set('status', ev.target.value as Draft['status'])}
                >
                  {initial.statuses.map((s) => (
                    <option key={s} value={s}>
                      {t(`webhooks.inbound.status.${s}` as never)}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          ) : (
            <fieldset style={{ display: 'grid', gap: '0.5rem' }}>
              <legend>{t('webhooks.inbound.section.event')}</legend>
              <label>
                {t('webhooks.inbound.field.event')}
                <select
                  value={draft.event}
                  onChange={(ev) => set('event', ev.target.value as WebhookEvent)}
                >
                  {initial.events.map((opt) => (
                    <option key={opt.event} value={opt.event}>
                      {eventLabel(opt.event)}
                    </option>
                  ))}
                </select>
              </label>
              <p>{t('webhooks.inbound.event.help')}</p>
            </fieldset>
          )}

          <fieldset style={{ display: 'grid', gap: '0.5rem' }}>
            <legend>{t('webhooks.inbound.section.security')}</legend>
            <label>
              {t('webhooks.inbound.field.window')}
              <select
                value={draft.windowSeconds}
                onChange={(ev) => set('windowSeconds', Number(ev.target.value))}
              >
                {initial.windows.map((w) => (
                  <option key={w} value={w}>
                    {t('webhooks.inbound.windowOption', { minutes: w / 60 })}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(ev) => set('enabled', ev.target.checked)}
              />{' '}
              {t('webhooks.enabledLabel')}
            </label>
            <p>
              {t('webhooks.inbound.howToSend', {
                header: 'X-Engage-Signature',
                idHeader: 'Idempotency-Key',
              })}
            </p>
          </fieldset>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="submit">{t('webhooks.save')}</button>
            <button type="button" onClick={() => setDraft(null)}>
              {t('webhooks.cancel')}
            </button>
            {draft.id !== null && (
              <button type="button" onClick={rotate}>
                {t('webhooks.inbound.secret.rotate')}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  )
}
