'use client'
import React, { useState } from 'react'

import { useVariationImage } from '@/components/VariationImageProvider'
import { orderGallery } from '@/features/ecommerce/lib/variationImage'

import './wave69.css'

/**
 * Wave 69 client island (Task 10): the product gallery with thumbnails and hover zoom.
 * When the buyer chooses a variation with its own image, that image moves to the front (orderGallery), the same
 * as the product page gallery. A thumbnail picked before a new variation is chosen is not kept.
 */
export function ProductGallery({ images, thumbnails, zoom }: { images: Array<{ url: string; alt: string }>; thumbnails: boolean; zoom: boolean }): React.ReactElement {
  const { imageUrl } = useVariationImage()
  const ordered = orderGallery(images, imageUrl)
  const [picked, setPicked] = useState<{ variation: string | null; url: string } | null>(null)
  const [pos, setPos] = useState<string | null>(null)
  const chosen = picked && picked.variation === imageUrl ? ordered.find((img) => img.url === picked.url) : undefined
  const cur = chosen ?? ordered[0]!
  return (
    <div className="w69-gallery">
      <div
        className={`w69-main${zoom ? ' w69-main--zoom' : ''}`}
        onMouseMove={zoom ? (e) => { const r = e.currentTarget.getBoundingClientRect(); setPos(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`) } : undefined}
        onMouseLeave={() => setPos(null)}
      >
        <img src={cur.url} alt={cur.alt} style={pos ? { transformOrigin: pos, transform: 'scale(2)' } : undefined} />
      </div>
      {thumbnails && ordered.length > 1 ? (
        <div className="w69-thumbs">
          {ordered.map((img, n) => (
            <button key={`${n}-${img.url}`} type="button" aria-label={`Show picture ${n + 1}`} aria-current={img.url === cur.url ? 'true' : undefined} onClick={() => setPicked({ variation: imageUrl, url: img.url })}>
              <img src={img.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
