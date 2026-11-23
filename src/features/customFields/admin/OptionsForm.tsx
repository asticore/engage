'use client'

import React, { useCallback, useState } from 'react'

import { CustomFieldInput, CustomFieldMediaContext, useMediaUrlsFor, type MediaUrlMap } from '@/fields/customFields/CustomFieldInput'
import type { CustomFieldDef, FieldGroupDoc } from '@/fields/customFields/types'
import { isFieldVisible } from '../conditions'
import { collectMediaIds } from '../stringify'
import { matchesLocation, optionsPageContext } from '../location'
import { CollapsibleCard } from '@/admin/components/CollapsibleCard'

/**
 * The form for one Options page. Values come from the server (initial render),
 * and save through POST /api/admin-field-options/<slug>, which validates and
 * drops hidden values again before storing.
 */

type Props = {
  slug: string
  groups: FieldGroupDoc[]
  userRoles: string[]
  initialValues: Record<string, unknown>
  /** The other active languages (empty when the site has one language). Their text values are edited here too. */
  locales?: string[]
  initialL10n?: Record<string, Record<string, string>>
  initialUpdatedAt: string | null
  initialMediaUrls: MediaUrlMap
}

const btnClass =
  'cursor-pointer rounded-[5px] border border-[#2e3192] bg-[#2e3192] px-[14px] py-[7px] text-[13px] font-semibold text-white disabled:opacity-50'

export function OptionsForm({ slug, groups, userRoles, initialValues, locales = [], initialL10n = {}, initialUpdatedAt, initialMediaUrls }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues)
  // '' is the default language; otherwise one of `locales`, where only text fields show and an empty box uses the default.
  const [lang, setLang] = useState('')
  const [l10n, setL10n] = useState<Record<string, Record<string, string>>>(initialL10n)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt)
  const [mediaUrls, setMediaUrls] = useState<MediaUrlMap>(initialMediaUrls)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const remember = useCallback((id: number, url: string) => {
    setMediaUrls((prev) => (prev[String(id)] === url ? prev : { ...prev, [String(id)]: url }))
  }, [])

  const allDefs: CustomFieldDef[] = groups.flatMap((g) => g.fields)
  useMediaUrlsFor(collectMediaIds(allDefs, values), remember)
  // Field value rules are checked against the values on the form as they are now.
  const shownGroups = groups.filter((group) => matchesLocation(group.location, optionsPageContext(slug, values, userRoles)))

  const isText = (def: CustomFieldDef) => def.type === 'text' || def.type === 'textarea'
  const setLangField = (name: string, next: unknown) => {
    setL10n((prev) => ({ ...prev, [lang]: { ...(prev[lang] ?? {}), [name]: typeof next === 'string' ? next : '' } }))
  }

  const setField = (name: string, next: unknown) => {
    setValues((prev) => {
      const updated = { ...prev }
      if (next === undefined || next === '') delete updated[name]
      else updated[name] = next
      return updated
    })
  }

  const save = async () => {
    setSaving(true)
    setBanner(null)
    try {
      const res = await fetch(`/api/admin-field-options/${encodeURIComponent(slug)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lang ? { locale: lang, values: l10n[lang] ?? {} } : { values }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        errors?: { path: string; message: string }[]
        updatedAt?: string
        values?: Record<string, unknown>
        error?: string
      }
      if (!res.ok) {
        const byLabel: Record<string, string> = {}
        for (const e of json.errors ?? []) byLabel[e.path] = e.message
        setErrors(byLabel)
        setBanner({ kind: 'error', text: json.errors?.length ? 'Some fields need attention.' : json.error || 'Could not save.' })
        return
      }
      setErrors({})
      setUpdatedAt(json.updatedAt ?? null)
      if (!lang && json.values) setValues(json.values)
      setBanner({ kind: 'ok', text: 'Saved.' })
    } catch {
      setBanner({ kind: 'error', text: 'Could not save. Check your connection and try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <CustomFieldMediaContext.Provider value={{ urls: mediaUrls, remember }}>
      <div className="flex flex-col gap-[20px]">
        {locales.length > 0 && (
          <label className="flex items-center gap-[8px] text-[13px]">
            Language
            <select value={lang} onChange={(e) => { setLang(e.target.value); setBanner(null) }} className="rounded-[5px] border border-[var(--theme-elevation-150,#cac7d1)] px-[8px] py-[4px]">
              <option value="">Default language</option>
              {locales.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            {lang && <span className="opacity-70">Text fields only. Leave a box empty to show the default.</span>}
          </label>
        )}
        {shownGroups.map((group) => (
          <CollapsibleCard
            key={group.id}
            id={`opt:${slug.replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 30)}:${group.id}`}
            title={group.name}
            className="border-t border-[var(--theme-elevation-150,#e2ded4)] pt-[12px]"
          >
            {group.description && <p className="m-0 mb-[12px] text-[12px] opacity-70">{group.description}</p>}
            <div className="flex flex-wrap gap-[16px] pt-[8px]">
              {group.fields
                .filter((def) => isFieldVisible(def, values) && (!lang || isText(def)))
                .map((def) => (
                  <CustomFieldInput
                    key={`${lang}:${def.name}`}
                    def={lang ? { ...def, helpText: typeof values[def.name] === 'string' && values[def.name] !== '' ? `Default: ${values[def.name] as string}` : def.helpText } : def}
                    value={lang ? l10n[lang]?.[def.name] : values[def.name]}
                    error={errors[def.label] ?? errors[def.name]}
                    idPrefix={`opt-${slug}${lang ? `-${lang}` : ''}`}
                    onChange={(next) => (lang ? setLangField(def.name, next) : setField(def.name, next))}
                  />
                ))}
            </div>
          </CollapsibleCard>
        ))}

        <div className="flex items-center gap-[12px]">
          <button type="button" className={btnClass} disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {updatedAt && <span className="text-[12px] opacity-65">Last saved {new Date(updatedAt).toLocaleString()}</span>}
          {banner && (
            <span role="status" className={`text-[13px] ${banner.kind === 'error' ? 'text-[#b3453a]' : ''}`}>
              {banner.text}
            </span>
          )}
        </div>
      </div>
    </CustomFieldMediaContext.Provider>
  )
}
