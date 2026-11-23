import type { FormColourKey, FormColours } from './types'

/**
 * The per-form colour overrides and the CSS custom property each one sets on
 * the form root. forms.css reads these with the current colour as fallback, so
 * a form with no overrides draws exactly as before.
 *
 * No imports from config.ts: the cleaning of values lives there (cleanColour),
 * and this file stays free of cycles so the renderer can use it directly.
 */
export const FORM_COLOUR_VARS: Record<FormColourKey, string> = {
  fieldBg: '--eg-form-field-bg',
  fieldText: '--eg-form-field-text',
  fieldBorder: '--eg-form-field-border',
  focusBorder: '--eg-form-focus',
  labelColour: '--eg-form-label',
  buttonBg: '--eg-form-button-bg',
  buttonText: '--eg-form-button-text',
  errorColour: '--eg-form-error',
  successColour: '--eg-form-success',
}

/** The keys in the order the settings panel shows them, with their labels. */
export const FORM_COLOUR_FIELDS: { key: FormColourKey; label: string }[] = [
  { key: 'fieldBg', label: 'Field background' },
  { key: 'fieldText', label: 'Field text' },
  { key: 'fieldBorder', label: 'Field border' },
  { key: 'focusBorder', label: 'Focus border' },
  { key: 'labelColour', label: 'Label' },
  { key: 'buttonBg', label: 'Button background' },
  { key: 'buttonText', label: 'Button text' },
  { key: 'errorColour', label: 'Error message' },
  { key: 'successColour', label: 'Success message' },
]

/** CSS custom properties for the form root: one per override that is set. */
export function formColourVars(colours: FormColours | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!colours) return out
  for (const { key } of FORM_COLOUR_FIELDS) {
    const value = colours[key]
    if (value) out[FORM_COLOUR_VARS[key]] = value
  }
  return out
}
