'use server'

import { headers } from 'next/headers'

import { getAdminContext } from '@/admin/auth'
import { refuseWhileImpersonating } from '@/features/impersonation/policy'
import { audit } from '@/features/security/auditLog'
import { getSecuritySettings } from '@/features/security/settings'

import { cleanEmbedName, cleanEmbedOrigins, cleanEmbedTheme, countEmbedsForForm, embedKeyTaken, findEmbedById, insertEmbed, listAllEmbeds, MAX_EMBEDS_PER_FORM, newEmbedKey, updateEmbedRow, type EmbedInput } from './embeds'
import { embedAdminRow, type EmbedAdminRow } from './embedAdmin'

/**
 * What the External embeds screen calls. Reading the list needs the Forms read permission. Creating an embed, or
 * changing its name, switch, websites or theme, needs the Forms integrations permission (the same rule the form
 * save uses), or admin. Forms are not changed here: an embed only points at a form.
 */

export type EmbedResult = { ok: true; id?: number } | { ok: false; error: string }

type Engine = Awaited<ReturnType<typeof getAdminContext>>['engine']

async function canRead(): Promise<{ engine: Engine; user: unknown } | null> {
  const context = await getAdminContext()
  if (!context.user) return null
  if (!(context.isAdmin || context.can('forms', 'read'))) return null
  return { engine: context.engine, user: context.user }
}

async function canChangeEmbeds(): Promise<{ engine: Engine; user: unknown; email: string } | null> {
  const context = await getAdminContext()
  if (!context.user) return null
  if (!(context.isAdmin || context.can('forms.integrations', 'update'))) return null
  return { engine: context.engine, user: context.user, email: String((context.user as { email?: unknown }).email ?? '') }
}

/** Every embed with its form, for the screen, and the forms that can take a new one. Canchange says whether the viewer may edit. */
export async function listEmbedsForAdmin(): Promise<{ ok: true; rows: EmbedAdminRow[]; forms: { id: number; title: string }[]; canChange: boolean } | { ok: false; error: string }> {
  const reader = await canRead()
  if (!reader) return { ok: false, error: 'You do not have access to Forms.' }
  const found = await reader.engine.find({ collection: 'forms', depth: 0, limit: 500, sort: 'title', user: reader.user as never })
  const formById = new Map<string, { title?: unknown; formStatus?: unknown }>()
  const forms: { id: number; title: string }[] = []
  for (const doc of found.docs) {
    const form = doc as { id: number | string; title?: unknown; formStatus?: unknown }
    formById.set(String(form.id), form)
    forms.push({ id: Number(form.id), title: typeof form.title === 'string' && form.title ? form.title : `Form #${form.id}` })
  }
  const embeds = await listAllEmbeds()
  const rows = embeds.flatMap((embed): EmbedAdminRow[] => {
    const form = formById.get(String(embed.formId))
    return form ? [embedAdminRow(embed, form)] : []
  })
  const canChange = (await canChangeEmbeds()) !== null
  return { ok: true, rows, forms, canChange }
}

function cleanInput(input: { name: unknown; enabled: unknown; allowedOrigins: unknown; theme: unknown }, fallbackName: string): EmbedInput {
  return {
    formId: 0,
    name: cleanEmbedName(input.name, fallbackName),
    enabled: input.enabled !== false,
    allowedOrigins: cleanEmbedOrigins(input.allowedOrigins),
    theme: cleanEmbedTheme(input.theme),
  }
}

/** Creates an embed of a form. It starts switched on unless the input says otherwise, and gets its own key. */
export async function createEmbed(input: { formId: number | string; name: string; allowedOrigins: string[]; theme: unknown }): Promise<EmbedResult> {
  const blocked = refuseWhileImpersonating(await headers())
  if (blocked) return { ok: false, error: blocked }
  const writer = await canChangeEmbeds()
  if (!writer) return { ok: false, error: 'You do not have permission to change embeds.' }
  const formId = typeof input.formId === 'string' && /^\d+$/.test(input.formId) ? Number(input.formId) : input.formId
  if (typeof formId !== 'number') return { ok: false, error: 'That form does not exist.' }
  const form = (await writer.engine.findByID({ collection: 'forms', depth: 0, id: formId, overrideAccess: true }).catch((): null => null)) as { title?: unknown } | null
  if (!form) return { ok: false, error: 'That form does not exist.' }
  if ((await countEmbedsForForm(formId)) >= MAX_EMBEDS_PER_FORM) return { ok: false, error: `A form can have up to ${MAX_EMBEDS_PER_FORM} embeds.` }
  let embedKey = newEmbedKey()
  for (let attempt = 0; attempt < 5 && (await embedKeyTaken(embedKey)); attempt++) embedKey = newEmbedKey()
  const data = { ...cleanInput({ name: input.name, enabled: true, allowedOrigins: input.allowedOrigins, theme: input.theme }, String(form.title || `Form #${formId}`)), formId }
  let id: number
  try {
    id = await insertEmbed({ ...data, embedKey })
  } catch {
    return { ok: false, error: 'The embed could not be saved. Try again.' }
  }
  await audit({ action: 'create', actorEmail: writer.email || null, collectionSlug: 'forms', documentId: formId, detail: `embed created: ${data.name}` }, await getSecuritySettings(writer.engine as never)).catch((): void => undefined)
  return { ok: true, id }
}

/**
 * Changes one embed: its name, switch, websites and theme. The key and the form never change, so a snippet already
 * placed on a site keeps working.
 */
export async function updateEmbed(input: { id: number | string; name: string; enabled: boolean; allowedOrigins: string[]; theme: unknown }): Promise<EmbedResult> {
  const blocked = refuseWhileImpersonating(await headers())
  if (blocked) return { ok: false, error: blocked }
  const writer = await canChangeEmbeds()
  if (!writer) return { ok: false, error: 'You do not have permission to change embeds.' }
  const id = typeof input.id === 'string' && /^\d+$/.test(input.id) ? Number(input.id) : input.id
  if (typeof id !== 'number') return { ok: false, error: 'That embed does not exist.' }
  const current = await findEmbedById(id).catch((): null => null)
  if (!current) return { ok: false, error: 'That embed does not exist.' }
  const data = { ...cleanInput({ name: input.name, enabled: input.enabled, allowedOrigins: input.allowedOrigins, theme: input.theme }, current.name), formId: current.formId }
  try {
    await updateEmbedRow(id, data)
  } catch {
    return { ok: false, error: 'The embed could not be saved. Try again.' }
  }
  await audit(
    {
      action: 'update',
      actorEmail: writer.email || null,
      collectionSlug: 'forms',
      documentId: current.formId,
      detail: `embed ${data.name} ${data.enabled ? 'on' : 'off'}, ${data.allowedOrigins.length} websites allowed`,
    },
    await getSecuritySettings(writer.engine as never),
  ).catch((): void => undefined)
  return { ok: true, id }
}
