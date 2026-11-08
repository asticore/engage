type SettingsReader = {
  findGlobal: (args: { slug: string; depth?: number }) => Promise<Record<string, unknown> | null>
}

/**
 * True while the owner has neither answered nor skipped the setup questions. A missing or
 * unreadable Site Settings document counts as "not asked yet" only when it can be read at all:
 * a read failure hides the questions rather than showing them on every visit.
 */
export async function setupQuestionnairePending(engine: SettingsReader): Promise<boolean> {
  const settings = await engine.findGlobal({ slug: 'site-settings', depth: 0 }).catch((): undefined => undefined)
  if (settings === undefined) return false
  const record = settings?.setupQuestionnaire
  return record === null || record === undefined || record === ''
}
