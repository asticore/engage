import { ProductAttributes } from '@/features/ecommerce/collections/ProductAttributes'
import { ProductReviews } from '@/features/ecommerce/collections/ProductReviews'
import { ProductBrands } from '@/features/ecommerce/collections/ProductBrands'
import { ProductTags } from '@/features/ecommerce/collections/ProductTags'
import { ShippingClasses } from '@/features/ecommerce/collections/ShippingClasses'

import { createCollectionOps } from '../generic'
import { productAttributes, productAttributesTerms, productBrands, productReviews, productTags, shippingClasses } from '../schema/shopCatalogue'

/** Loosely typed documents for the catalogue collections - see src/features/ecommerce/collections. */
type Doc = { id: number; updatedAt: string; createdAt: string } & Record<string, unknown>
type Page = ReturnType<ReturnType<typeof createCollectionOps>['findPaginated']>
type PageArgs = { where?: import('@/engine').Where; sort?: import('@/engine').Sort; limit?: number; page?: number; pagination?: boolean }

const attributeOps = createCollectionOps(productAttributes, ProductAttributes, { terms: productAttributesTerms })
export const findProductAttributesPaginated = attributeOps.findPaginated as unknown as (args?: PageArgs) => Page
export const findProductAttributeByID = attributeOps.findByID as unknown as (id: number) => Promise<Doc | null>
export const countProductAttributes = attributeOps.count
export const createProductAttribute = attributeOps.create as unknown as (data: Record<string, unknown>) => Promise<Doc>
export const updateProductAttribute = attributeOps.updateByID as unknown as (id: number, data: Record<string, unknown>) => Promise<Doc | null>
export const deleteProductAttribute = attributeOps.deleteByID

const tagOps = createCollectionOps(productTags, ProductTags)
export const findProductTagsPaginated = tagOps.findPaginated as unknown as (args?: PageArgs) => Page
export const findProductTagByID = tagOps.findByID as unknown as (id: number) => Promise<Doc | null>
export const countProductTags = tagOps.count
export const createProductTag = tagOps.create as unknown as (data: Record<string, unknown>) => Promise<Doc>
export const updateProductTag = tagOps.updateByID as unknown as (id: number, data: Record<string, unknown>) => Promise<Doc | null>
export const deleteProductTag = tagOps.deleteByID

const brandOps = createCollectionOps(productBrands, ProductBrands)
export const findProductBrandsPaginated = brandOps.findPaginated as unknown as (args?: PageArgs) => Page
export const findProductBrandByID = brandOps.findByID as unknown as (id: number) => Promise<Doc | null>
export const countProductBrands = brandOps.count
export const createProductBrand = brandOps.create as unknown as (data: Record<string, unknown>) => Promise<Doc>
export const updateProductBrand = brandOps.updateByID as unknown as (id: number, data: Record<string, unknown>) => Promise<Doc | null>
export const deleteProductBrand = brandOps.deleteByID

const classOps = createCollectionOps(shippingClasses, ShippingClasses)
export const findShippingClassesPaginated = classOps.findPaginated as unknown as (args?: PageArgs) => Page
export const findShippingClassByID = classOps.findByID as unknown as (id: number) => Promise<Doc | null>
export const countShippingClasses = classOps.count
export const createShippingClass = classOps.create as unknown as (data: Record<string, unknown>) => Promise<Doc>
export const updateShippingClass = classOps.updateByID as unknown as (id: number, data: Record<string, unknown>) => Promise<Doc | null>
export const deleteShippingClass = classOps.deleteByID

const reviewOps = createCollectionOps(productReviews, ProductReviews)
export const findProductReviewsPaginated = reviewOps.findPaginated as unknown as (args?: PageArgs) => Page
export const findProductReviewByID = reviewOps.findByID as unknown as (id: number) => Promise<Doc | null>
export const countProductReviews = reviewOps.count
export const createProductReview = reviewOps.create as unknown as (data: Record<string, unknown>) => Promise<Doc>
export const updateProductReview = reviewOps.updateByID as unknown as (id: number, data: Record<string, unknown>) => Promise<Doc | null>
export const deleteProductReview = reviewOps.deleteByID
