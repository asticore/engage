import type { Field } from '@/engine'

/**
 * Composite products ("build your own kit"): one collapsible card in the product edit screen. Two flat lists, so
 * no nested tables are needed (rules in lib/composite.ts). Column names follow src/cms/db/schema/generate.ts; the
 * migration in src/migrations/20270317_265000_composite_products.ts creates exactly these (child tables
 * eg_products_composite_options and eg_products_composite_rules, and the versioned copies).
 *
 * `admin.condition` functions are shipped to the browser as source text, so each one must be
 * self-contained: no imports, no outer variables.
 */
export const compositeFields: Field[] = [
  {
    type: 'collapsible',
    label: 'Kit choices (composite product)',
    admin: { condition: (data) => data?.productType === 'composite' },
    fields: [
      {
        name: 'compositeOptions',
        type: 'array',
        labels: { singular: 'Item', plural: 'Items to choose from' },
        admin: {
          description:
            'The Regular price above is the starting price of the kit. List every item the buyer can pick, and the step it belongs to (steps are shown in the order they first appear). Each picked item is taken from its own stock when the kit sells. Only simple products can be offered.',
          initCollapsed: true,
        },
        fields: [
          { name: 'component', type: 'text', required: true, admin: { width: '50%', description: 'The step this item belongs to, typed the same way for every item in the step, e.g. Choose a coffee.' } },
          { name: 'product', type: 'relationship', relationTo: 'products', admin: { width: '50%', description: 'A simple product.' } },
          {
            type: 'row',
            fields: [
              {
                name: 'priceMode',
                type: 'select',
                defaultValue: 'included',
                options: [
                  { label: 'Included in the kit price', value: 'included' },
                  { label: 'Adds a price', value: 'add' },
                  { label: 'Its own price less a percentage', value: 'discount' },
                ],
                admin: { width: '40%', description: 'What this item does to the kit price when picked.' },
              },
              {
                name: 'priceValue',
                type: 'number',
                min: 0,
                admin: {
                  width: '30%',
                  condition: (data) => data?.priceMode === 'add' || data?.priceMode === 'discount',
                  description: 'Adds a price: dollars added (blank adds the product\'s own price). Percentage: the discount, 0 to 100.',
                },
              },
              { name: 'isDefault', type: 'checkbox', defaultValue: false, admin: { width: '30%', description: 'Picked to start with on the product page.' } },
            ],
          },
        ],
      },
      {
        name: 'compositeRules',
        type: 'array',
        labels: { singular: 'Step rule', plural: 'Step rules' },
        admin: {
          description: 'Optional. A step with no rule is required and takes exactly one item. Add a rule to give a step help text, make it optional, or let the buyer pick several.',
          initCollapsed: true,
        },
        fields: [
          { name: 'component', type: 'text', required: true, admin: { description: 'The step name, exactly as typed in the items above.' } },
          { name: 'description', type: 'text', admin: { description: 'Help text shown under the step.' } },
          {
            type: 'row',
            fields: [
              { name: 'required', type: 'checkbox', defaultValue: true, admin: { width: '34%', description: 'The buyer must pick for this step.' } },
              { name: 'minChoices', type: 'number', min: 1, admin: { width: '33%', description: 'Fewest items to pick (required steps). Blank means 1.' } },
              { name: 'maxChoices', type: 'number', min: 1, admin: { width: '33%', description: 'Most items to pick. Blank means 1.' } },
            ],
          },
        ],
      },
    ],
  },
]
