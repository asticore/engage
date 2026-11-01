import { ProductAttributes } from '@/features/ecommerce/collections/ProductAttributes'
import { ProductBrands } from '@/features/ecommerce/collections/ProductBrands'
import { ProductTags } from '@/features/ecommerce/collections/ProductTags'
import { ProductReviews } from '@/features/ecommerce/collections/ProductReviews'
import { ShippingClasses } from '@/features/ecommerce/collections/ShippingClasses'

import { generateArrayTable, generateTable } from './generate'

/** Tables for the catalogue collections (own file so the schema index stays small). */
export const productAttributesGenerated = generateTable(ProductAttributes)
export const productAttributes = productAttributesGenerated.table
const [productAttributesTermsField] = productAttributesGenerated.arrayFields
export const productAttributesTerms = generateArrayTable(ProductAttributes.slug, productAttributesGenerated.tableName, productAttributesTermsField).table

export const productTagsGenerated = generateTable(ProductTags)
export const productTags = productTagsGenerated.table

export const productBrandsGenerated = generateTable(ProductBrands)
export const productBrands = productBrandsGenerated.table

export const shippingClassesGenerated = generateTable(ShippingClasses)
export const shippingClasses = shippingClassesGenerated.table

export const productReviewsGenerated = generateTable(ProductReviews)
export const productReviews = productReviewsGenerated.table
