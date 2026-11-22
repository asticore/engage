/** The Pinterest Tag ID from Tracking connections (a public ID). Blank or unreadable means no tag. */
export const loadPinterestTagId = async (): Promise<string | undefined> => {
  try {
    const { getEngine } = await import('@/lib/engine')
    const engine = await getEngine()
    const doc = (await engine.findGlobal({ slug: 'tracking-connections', depth: 0, overrideAccess: true }).catch((): null => null)) as { pinterestTagId?: unknown } | null
    const id = typeof doc?.pinterestTagId === 'string' ? doc.pinterestTagId.trim() : ''
    return /^\d{10,16}$/.test(id) ? id : undefined
  } catch {
    return undefined
  }
}
