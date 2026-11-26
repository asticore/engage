/** Common display ad sizes offered as ticks beside an ad unit's size boxes. The boxes stay free text (WIDTHxHEIGHT, comma separated). */

export type CommonSize = { size: string; label: string }

export const COMMON_SIZES: CommonSize[] = [
  { size: '320x50', label: 'Mobile banner' },
  { size: '320x100', label: 'Large mobile banner' },
  { size: '300x250', label: 'Medium rectangle' },
  { size: '336x280', label: 'Large rectangle' },
  { size: '300x600', label: 'Half page' },
  { size: '160x600', label: 'Wide skyscraper' },
  { size: '728x90', label: 'Leaderboard' },
  { size: '970x90', label: 'Large leaderboard' },
  { size: '970x250', label: 'Billboard' },
]

const split = (text: string): string[] => text.split(/[\s,]+/).filter(Boolean)

/** True when the text already lists the size. */
export const hasSize = (text: string, size: string): boolean => split(text).includes(size)

/** Adds the size when missing, removes it when present. Other entries (including custom sizes) are kept in order. */
export function toggleSize(text: string, size: string): string {
  const parts = split(text)
  return (parts.includes(size) ? parts.filter((p) => p !== size) : [...parts, size]).join(', ')
}
