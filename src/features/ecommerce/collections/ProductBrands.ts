import type { CollectionConfig } from '@/engine'

import { roleAccess } from '@/access/ecommerceAccess'

import { slugify } from '../slugify'

/**
 * Brands a product can be sold under. One brand per product, picked from this list, so the shop can show
 * the brand on the product page and in product lists without anyone retyping it.
 */
export const ProductBrands: CollectionConfig = {
  slug: 'product-brands',
  dbName: 'eg_product_brands',
  labels: { singular: 'Product brand', plural: 'Product brands' },
  admin: {
    group: 'Ecommerce',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'updatedAt'],
    description: 'Brands a product is sold under. Pick one on a product.',
  },
  access: {
    create: roleAccess('product-brands', 'create'),
    read: () => true,
    update: roleAccess('product-brands', 'update'),
    delete: roleAccess('product-brands', 'delete'),
  },
  timestamps: true,
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    { name: 'slug', type: 'text', unique: true, index: true, admin: { position: 'sidebar' } },
    { name: 'description', type: 'textarea' },
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
