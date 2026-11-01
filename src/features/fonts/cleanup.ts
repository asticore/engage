/**
 * Removes the R2 files of locally hosted fonts that a save took out of the
 * site. Runs after the save commits (from the site settings afterChange hook),
 * so a failed save never deletes a file the site still uses.
 */
import { deleteMediaObject } from '@/localapi/storage'
import { LOCAL_FONT_PATH_PREFIX, sanitizeInstalledFonts } from './installed'

/** The R2 keys of every locally stored font file in a list of installed fonts. */
export function localFontKeys(fonts: unknown): Set<string> {
  const keys = new Set<string>()
  for (const font of sanitizeInstalledFonts(fonts)) {
    if (!font.local && font.source !== 'upload') continue
    for (const url of Object.values(font.files)) {
      if (url.startsWith(LOCAL_FONT_PATH_PREFIX)) keys.add(url.slice(LOCAL_FONT_PATH_PREFIX.length))
    }
  }
  return keys
}

/** Deletes the files that were in `previous` but are no longer in `next`. Returns the keys deleted. */
export async function removeDroppedFontFiles(previous: unknown, next: unknown): Promise<string[]> {
  const kept = localFontKeys(next)
  const dropped = [...localFontKeys(previous)].filter((key) => !kept.has(key))
  for (const key of dropped) await deleteMediaObject(key)
  return dropped
}
