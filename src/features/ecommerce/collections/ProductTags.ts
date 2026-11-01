import type { CollectionConfig } from '@/engine'

import { roleAccess } from '@/access/ecommerceAccess'

import { slugify } from '../slugify'

/**
 * Tags for grouping products (Gift ideas, Best sellers ...). A product picks its tags from this list on its
 * Organise panel, so every tag is chosen rather than typed on each product. Bulk actions on the product list can add or remove them.
 */
export const ProductTags: CollectionConfig = {
  slug: 'product-tags',
  dbName: 'eg_product_tags',
  labels: { singular: 'Product tag', plural: 'Product tags' },
  admin: {
    group: 'Ecommerce',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'updatedAt'],
    description: 'Labels that group products. Pick them on a product, or add them to many products at once from the product list.',
  },
  access: {
    create: roleAccess('product-tags', 'create'),
    read: () => true,
    update: roleAccess('product-tags', 'update'),
    delete: roleAccess('product-tags', 'delete'),
  },
  timestamps: true,
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    { name: 'slug', type: 'text', unique: true, index: true, admin: { position: 'sidebar' } },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && typeof data.name === 'string' && !(typeof data.slug === 'string' && data.slug.trim())) data.slug = slugify(data.name)
        return data
      },
    ],
  },
}
