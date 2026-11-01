import { cache } from 'react'
import { getEngine } from '@/lib/engine'
import { BUILT_IN_FACES, builtInFontFileName } from './builtIn'

/** Whether the admin chose to serve the built-in theme fonts from this site (Speed settings). Never throws: a failed read means jsDelivr, as before. */
export const readSelfHostBuiltInFonts = cache(async (): Promise<boolean> => {
  try {
    const engine = await getEngine()
    const settings = (await engine.findGlobal({ slug: 'speed-settings', depth: 0 }).catch((): null => null)) as
      | { fonts?: { selfHostBuiltInFonts?: unknown } }
      | null
    return settings?.fonts?.selfHostBuiltInFonts === true
  } catch {
    return false
  }
})

/** The R2 key a self-hosted built-in font file is kept under: the same path as its URL, without the leading slash. */
export function builtInFontKey(packagePath: string, file: string): string {
  return `fonts-builtin/${packagePath}/${file}`
}

/**
 * Whether `packagePath` (`inter@5.3.0`) and `file` (`inter-latin-400-normal.woff2`)
 * name a built-in face at its pinned version, with a file the theme could ask for.
 */
export function isBuiltInFontFile(packagePath: string, file: string): boolean {
  const at = packagePath.lastIndexOf('@')
  if (at <= 0) return false
  const id = packagePath.slice(0, at)
  const version = packagePath.slice(at + 1)
  const face = Object.values(BUILT_IN_FACES).find((candidate) => candidate.id === id && candidate.version === version)
  if (!face) return false
  return face.weights.some((weight) => face.subsets.some((subset) => builtInFontFileName(face, subset, weight) === file))
}
