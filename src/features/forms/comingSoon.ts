import type { FormDoc, FormFieldDef } from './types'

import { isPublished } from './layout'
import { loadForm, type LookupEngine } from './server'
import { FORMS_SLUG, type CreateArgs } from './slugs'
import { COMING_SOON_FORM_KEY, COMING_SOON_FORM_TITLE } from './comingSoonKey'

export { COMING_SOON_FORM_KEY, COMING_SOON_FORM_TITLE } from './comingSoonKey'

/** The one field the signup asks for. */
export const COMING_SOON_FORM_FIELDS: FormFieldDef[] = [{ type: 'email', name: 'email', label: 'Email address', required: true }]

export type ComingSoonEngine = LookupEngine & { create: (args: CreateArgs) => Promise<unknown> }

/**
 * The built-in form, created the first time it is needed. Idempotent: once it
 * exists, later calls only read it. The form is published so the signup works
 * at once; an admin turns the signup off by setting the form to Draft.
 * Never throws - a failed write returns null and the screen shows no signup.
 */
export async function ensureComingSoonForm(engine: ComingSoonEngine): Promise<FormDoc | null> {
  const existing = await loadForm(engine, COMING_SOON_FORM_KEY)
  if (existing) return existing
  try {
    await engine.create({
      collection: FORMS_SLUG,
      data: { title: COMING_SOON_FORM_TITLE, formStatus: 'published', fields: COMING_SOON_FORM_FIELDS },
      // Read by the Forms create hook, which then uses this key instead of a random one.
      context: { builtInEmbedKey: COMING_SOON_FORM_KEY },
      overrideAccess: true,
    } as unknown as CreateArgs)
  } catch {
    return null
  }
  return loadForm(engine, COMING_SOON_FORM_KEY)
}

/** Whether the signup should show: the built-in form exists and is not a draft. */
export const comingSoonSignupOpen = (form: FormDoc | null | undefined): boolean => Boolean(form) && isPublished(form as FormDoc)
