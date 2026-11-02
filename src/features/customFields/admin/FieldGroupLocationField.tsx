'use client'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import React, { useEffect, useState } from 'react'
import { useField } from '@/engine/ui'

import { LOCATION_PARAMS, type CustomFieldDef, type FieldGroupDoc, type LocationGroups, type LocationParam, type LocationRule } from '@/fields/customFields/types'

import { rawLocationGroups } from '../normalize'

/**
 * "Show on" editor for a Field Group. OR of AND-rules, same as the stored
 * `location` JSON. An empty list falls back to the quick "Applies to" list.
 */

const PARAM_LABELS: Record<(typeof LOCATION_PARAMS)[number], string> = {
  collection: 'Collection',
  optionsPage: 'Options page',
  pageTemplate: 'Page template ID (or "none")',
  pageParent: 'Parent page ID (or "none")',
  postCategory: 'Post category name',
  postTag: 'Post tag',
  userRole: 'Editor role',
  status: 'Status',
  fieldValue: 'Field value (options page)',
}

const COLLECTIONS = ['pages', 'posts', 'products', 'events', 'faqs']
const ROLES = ['admin', 'editor', 'viewer']
const STATUSES = ['draft', 'published']

const inputClass =
  'rounded-[5px] border border-[var(--theme-elevation-150,#cac7d1)] bg-[var(--theme-input-bg,#fff)] px-[8px] py-[6px] text-[13px] text-inherit [font-family:inherit]'
const buttonClass =
  'cursor-pointer rounded-[5px] border border-[var(--theme-elevation-150,#cac7d1)] bg-transparent px-[9px] py-[4px] text-[12px] text-inherit hover:border-[#2e3192]'

/** Every field of every Field Group, for the "Field value" rule to pick from. */
function useFieldChoices(): CustomFieldDef[] {
  const [choices, setChoices] = useState<CustomFieldDef[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin-field-groups', { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<{ groups?: FieldGroupDoc[] }>) : null))
      .then((json) => {
        if (cancelled || !json?.groups) return
        const byName = new Map<string, CustomFieldDef>()
        for (const group of json.groups) for (const def of group.fields) if (!byName.has(def.name)) byName.set(def.name, def)
        setChoices([...byName.values()])
      })
      .catch((): void => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return choices
}

function FieldPicker({ rule, choices, onChange }: { rule: LocationRule; choices: CustomFieldDef[]; onChange: (field: string) => void }) {
  const t = useAdminT()
  return (
    <select className={inputClass} aria-label={t('al.value')} value={rule.field ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a field</option>
      {choices.map((def) => (
        <option key={def.name} value={def.name}>
          {def.label || def.name} ({def.name})
        </option>
      ))}
    </select>
  )
}

function ValueInput({ rule, choices, onChange }: { rule: LocationRule; choices: CustomFieldDef[]; onChange: (value: string) => void }) {
  const t = useAdminT()
  if (rule.param === 'fieldValue') {
    const def = choices.find((candidate) => candidate.name === rule.field)
    const options = def?.type === 'checkbox' ? [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }] : def?.options ?? []
    if (options.length > 0) {
      return (
        <select className={inputClass} aria-label={t('al.value')} value={rule.value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose a value</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    }
  }
  if (rule.param === 'collection') {
    return (
      <select className={inputClass} aria-label={t('al.value')} value={rule.value} onChange={(e) => onChange(e.target.value)}>
        {COLLECTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    )
  }
  if (rule.param === 'userRole') {
    return (
      <select className={inputClass} aria-label={t('al.value')} value={rule.value} onChange={(e) => onChange(e.target.value)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    )
  }
  if (rule.param === 'status') {
    return (
      <select className={inputClass} aria-label={t('al.value')} value={rule.value} onChange={(e) => onChange(e.target.value)}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    )
  }
  return <input className={inputClass} aria-label={t('al.value')} value={rule.value} onChange={(e) => onChange(e.target.value)} />
}

export const FieldGroupLocationField: React.FC<{ path?: string }> = ({ path = 'location' }) => {
  const t = useAdminT()
  const { value, setValue } = useField<unknown>({ path })
  const choices = useFieldChoices()
  // Raw, so a rule being filled in is not dropped while it is still blank.
  const groups: LocationGroups = rawLocationGroups(value)
  const update = (next: LocationGroups) => setValue(next)
  const blank = (): LocationRule => ({ param: 'collection', operator: 'equals', value: 'pages' })

  return (
    <div className="mb-[24px] flex flex-col gap-[8px]">
      <h3 className="m-0 text-[15px]">Show on</h3>
      <p className="m-0 text-[12px] opacity-70">
        Rows in one block must all match (AND). Blocks are alternatives (OR). Leave empty to use the quick &quot;Applies to&quot; list instead.
      </p>
      <p className="m-0 text-[12px] opacity-70">
        For an options page, choose &quot;Options page&quot; and type its name, eg &quot;business&quot;. Its tags then look like {'{{option:business.phone}}'}.
        On an options page, &quot;Editor role&quot; and &quot;Field value&quot; rules work too: a field value rule compares another field&apos;s saved value (save that field first).
      </p>
      {groups.map((rules, gi) => (
        <div key={gi} className="flex flex-col gap-[6px] rounded-[6px] border border-[var(--theme-elevation-150,#e2ded4)] p-[10px]">
          {gi > 0 && <span className="text-[11px] font-semibold uppercase opacity-60">or</span>}
          {rules.map((rule, ri) => (
            <div key={ri} className="flex flex-wrap items-center gap-[6px]">
              {ri > 0 && <span className="text-[11px] uppercase opacity-60">and</span>}
              <select
                className={inputClass}
                aria-label={t('al.rule')}
                value={rule.param}
                onChange={(e) => update(groups.map((g, i) => (i === gi ? g.map((r, j) => (j === ri ? { ...r, param: e.target.value as LocationParam, value: '', field: undefined } : r)) : g)))}
              >
                {LOCATION_PARAMS.map((p) => (
                  <option key={p} value={p}>
                    {PARAM_LABELS[p]}
                  </option>
                ))}
              </select>
              {rule.param === 'fieldValue' && (
                <FieldPicker
                  rule={rule}
                  choices={choices}
                  onChange={(field) => update(groups.map((g, i) => (i === gi ? g.map((r, j) => (j === ri ? { ...r, field, value: '' } : r)) : g)))}
                />
              )}
              <select
                className={inputClass}
                aria-label={t('al.operator')}
                value={rule.operator}
                onChange={(e) => update(groups.map((g, i) => (i === gi ? g.map((r, j) => (j === ri ? { ...r, operator: e.target.value as 'equals' | 'notEquals' } : r)) : g)))}
              >
                <option value="equals">is</option>
                <option value="notEquals">is not</option>
              </select>
              <ValueInput
                rule={rule}
                choices={choices}
                onChange={(v) => update(groups.map((g, i) => (i === gi ? g.map((r, j) => (j === ri ? { ...r, value: v } : r)) : g)))}
              />
              <button type="button" className={buttonClass} onClick={() => update(groups.map((g, i) => (i === gi ? g.filter((_, j) => j !== ri) : g)).filter((g) => g.length))}>
                ✕
              </button>
            </div>
          ))}
          <div>
            <button type="button" className={buttonClass} onClick={() => update(groups.map((g, i) => (i === gi ? [...g, blank()] : g)))}>
              + and
            </button>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className={buttonClass} onClick={() => update([...groups, [blank()]])}>
          + or
        </button>
      </div>
    </div>
  )
}

export default FieldGroupLocationField
