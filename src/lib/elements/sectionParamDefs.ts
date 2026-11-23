import type { EditorField } from './fieldTypes'
import type { ElementDef } from './registry'
import { INSTANCE_ELEMENT, PARAMS_ELEMENT, PARAM_TYPES } from '../sectionParams'

/**
 * Reusable section inputs (Task 13 / 32c). `section-params` sits inside a reusable section and declares the inputs;
 * `section-instance` places that section with its own values. Both render on the server (SITE_ELEMENT_TYPES): the
 * declaration draws nothing, the instance reads the source section live. Rules: src/lib/sectionParams.ts.
 */
const text = (name: string, label: string, extra: Partial<EditorField> = {}): EditorField => ({ name, label, type: 'text', width: 'half', ...extra })

export const SECTION_PARAM_ELEMENTS: ElementDef[] = [
  {
    type: PARAMS_ELEMENT, label: 'Section inputs', icon: String.fromCodePoint(0x2699), category: 'siteMeta',
    description: 'Put this inside a reusable section to declare its inputs (text, link, image, colour, number or choice). Use {{param:key}} in the section where each value should appear. Draws nothing on the page.',
    fields: [
      {
        name: 'params', label: 'Inputs (up to 12)', type: 'repeater',
        repeater: {
          fields: [
            text('key', 'Key', { helpText: 'Lower case letters, digits and _, for example title. Used as {{param:title}}.' }),
            text('label', 'Label'),
            { name: 'type', label: 'Type', type: 'select', width: 'half', options: PARAM_TYPES.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v })) },
            text('default', 'Default value', { helpText: 'Shown where an instance does not set its own. Image: a media id.' }),
            text('choices', 'Choices', { helpText: 'Choice only: the options separated by commas.' }),
          ],
        },
      },
    ],
    defaultProps: () => ({ params: [] }),
  },
  {
    type: INSTANCE_ELEMENT, label: 'Reusable section with inputs', icon: String.fromCodePoint(0x1f9e9), category: 'layout',
    description: 'A reusable section with its own values for the inputs it declares. Change the layout of the source section and every use updates; inputs you leave alone follow the source default.',
    fields: [
      { name: 'section', label: 'Reusable section', type: 'select', width: 'full', optionsUrl: '/api/admin-section-params', options: [], helpText: 'Content > Reusable sections. The inputs it declares appear below.' },
    ],
    defaultProps: () => ({ section: '', values: {} }),
  },
]
