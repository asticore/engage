/**
 * Task 21k: how the language switcher element looks. Pure. Flags are optional and drawn from the region
 * of the code (en-AU gives Australia) or a usual country for the language; a flag is never the only label.
 */

export const SWITCHER_DISPLAYS = ['name', 'code', 'flag-name', 'flag'] as const
export type SwitcherDisplay = (typeof SWITCHER_DISPLAYS)[number]
export const SWITCHER_LAYOUTS = ['row', 'list'] as const
export type SwitcherLayout = (typeof SWITCHER_LAYOUTS)[number]
export const SWITCHER_HOVERS = ['underline', 'background', 'none'] as const
export type SwitcherHover = (typeof SWITCHER_HOVERS)[number]

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T => (allowed as readonly string[]).includes(value as string) ? (value as T) : fallback

export const switcherOptions = (p: Record<string, unknown>): { display: SwitcherDisplay; layout: SwitcherLayout; hover: SwitcherHover; align: 'start' | 'center' | 'end' } => ({
  display: pick(SWITCHER_DISPLAYS, p.display, 'name'),
  layout: pick(SWITCHER_LAYOUTS, p.layout, 'row'),
  hover: pick(['underline', 'background', 'none'] as const, p.hover, 'underline'),
  align: pick(['start', 'center', 'end'] as const, p.align, 'start'),
})

const LANGUAGE_COUNTRY: Record<string, string> = {
  en: 'GB', es: 'ES', fr: 'FR', de: 'DE', it: 'IT', pt: 'PT', nl: 'NL', ru: 'RU', ja: 'JP', ko: 'KR', zh: 'CN', ar: 'SA', hi: 'IN', sv: 'SE', pl: 'PL', tr: 'TR', el: 'GR', he: 'IL', vi: 'VN', th: 'TH', id: 'ID', da: 'DK', fi: 'FI', no: 'NO', cs: 'CZ', uk: 'UA',
}

/** The flag emoji for a language code, or '' when there is no good match. */
export function flagFor(code: string): string {
  const parts = code.replace('_', '-').split('-')
  const region = parts.find((p, i) => i > 0 && /^[A-Za-z]{2}$/.test(p))
  const country = (region ? region.toUpperCase() : LANGUAGE_COUNTRY[parts[0].toLowerCase()]) ?? ''
  if (!/^[A-Z]{2}$/.test(country)) return ''
  return String.fromCodePoint(...[...country].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/** What to show for one language: the flag, the own-language name, the short code, or a mix. */
export function switcherLabel(code: string, name: string, display: SwitcherDisplay): { text: string; flag: string } {
  const flag = display === 'flag' || display === 'flag-name' ? flagFor(code) : ''
  if (display === 'code') return { text: code.split('-')[0].toUpperCase(), flag: '' }
  if (display === 'flag') return { text: flag ? '' : name, flag }
  return { text: name, flag }
}
