import React from 'react'

import { brandName, fillLine, tagNames } from '@/features/ecommerce/lib/productTaxonomy'

/** The product's brand and tags under the short description. Renders nothing when neither is set. */
export function ProductTaxonomy({ brand, tags, brandLine, tagsLine }: { brand: unknown; tags: unknown; brandLine: string; tagsLine: string }) {
  const brandText = brandName(brand)
  const tagList = tagNames(tags)
  if (!brandText && tagList.length === 0) return null
  return (
    <div className="mb-6 flex flex-col gap-1 text-[0.9rem]">
      {brandText ? <p className="m-0">{fillLine(brandLine, brandText)}</p> : null}
      {tagList.length > 0 ? <p className="m-0">{fillLine(tagsLine, tagList.join(', '))}</p> : null}
    </div>
  )
}
