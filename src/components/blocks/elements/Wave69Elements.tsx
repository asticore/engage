'use client'
import React, { useState } from 'react'

import './wave69.css'

/** Wave 69 client island (Task 10): the product gallery with thumbnails and hover zoom. */

export function ProductGallery({ images, thumbnails, zoom }: { images: Array<{ url: string; alt: string }>; thumbnails: boolean; zoom: boolean }): React.ReactElement {
  const [i, setI] = useState(0)
  const [pos, setPos] = useState<string | null>(null)
  const cur = images[Math.min(i, images.length - 1)]!
  return (
    <div className="w69-gallery">
      <div
        className={`w69-main${zoom ? ' w69-main--zoom' : ''}`}
        onMouseMove={zoom ? (e) => { const r = e.currentTarget.getBoundingClientRect(); setPos(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`) } : undefined}
        onMouseLeave={() => setPos(null)}
      >
        <img src={cur.url} alt={cur.alt} style={pos ? { transformOrigin: pos, transform: 'scale(2)' } : undefined} />
      </div>
      {thumbnails && images.length > 1 ? (
        <div className="w69-thumbs">
          {images.map((img, n) => (
            <button key={`${n}-${img.url}`} type="button" aria-label={`Show picture ${n + 1}`} aria-current={n === i ? 'true' : undefined} onClick={() => setI(n)}>
              <img src={img.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
