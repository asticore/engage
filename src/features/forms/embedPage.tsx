import { notFound } from 'next/navigation'
import React from 'react'

import { loadThemeStyles } from '@/features/themeStyles/store'

import { readPlacesBrowserKey } from './placesKey'
import { embedThemeStyle, findEmbedByKey, type EmbedRecord } from './embeds'
import { loadPublishedForm } from './server'
import { formsEnabled, getFormSettings, resolveForForm, toPublicConfig } from './settings'
import { FormRenderer } from './components/FormRenderer'

type Engine = Parameters<typeof loadPublishedForm>[0]

/**
 * The hosted page of one embed (/embed/<key>, and the older /embed/forms/<key>). The form is the one the embed
 * belongs to; the embed supplies the submit key (so its entries are labelled with its source and its websites
 * are checked), and the theme (its colour, font and radius picks from the site's own styles).
 *
 * It answers "not found" for an unknown key, an embed that is switched off, a form that is a draft, and while
 * the Forms feature is off: the same answer in each case, so the address reveals nothing.
 */
export async function loadEmbedPage(
  engine: Engine,
  key: string,
  query: Record<string, string | string[] | undefined>,
  siteColourIds: ReadonlySet<string>,
): Promise<{ embed: EmbedRecord; config: Parameters<typeof FormRenderer>[0]['config'] } | null> {
  if (!(await formsEnabled(engine as never))) return null
  const embed = await findEmbedByKey(key).catch((): null => null)
  if (!embed || !embed.enabled) return null
  const form = await loadPublishedForm(engine, embed.formId)
  if (!form) return null
  const resolved = resolveForForm(form, await getFormSettings(engine as never))
  const base = toPublicConfig(form, resolved, { query })
  const config = {
    ...base,
    key: embed.embedKey,
    embedStyle: embedThemeStyle(embed.theme, siteColourIds),
    mapsKey: await readPlacesBrowserKey(engine as never, base.fields),
  }
  return { embed, config }
}

/** The page body for an embed address: the form on its own, or not found. */
export async function renderEmbedPage(
  engine: Engine,
  key: string,
  query: Record<string, string | string[] | undefined>,
  siteColourIds: ReadonlySet<string>,
): Promise<React.ReactElement> {
  const page = await loadEmbedPage(engine, key, query, siteColourIds)
  if (!page) notFound()
  return <FormRenderer config={page.config} embed />
}

/** The palette colour ids the theme styles define. Empty when the theme cannot be read: the embed then uses the site accent. */
export async function siteColourIds(): Promise<ReadonlySet<string>> {
  try {
    const { styles } = await loadThemeStyles()
    return new Set(styles.colours.map((colour) => colour.id))
  } catch {
    return new Set<string>()
  }
}
