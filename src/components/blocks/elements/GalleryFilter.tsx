'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * Category chips for a gallery. Every picture carries data-cat on its list item; choosing a chip hides the
 * other pictures. The chips only appear once the page has loaded, so without JavaScript every picture shows.
 */
export const GalleryFilter: React.FC<{ categories: string[]; allLabel: string; children: React.ReactNode }> = ({ categories, allLabel, children }) => {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [active, setActive] = useState('')

  useEffect(() => setReady(true), [])
  useEffect(() => {
    box.current?.querySelectorAll<HTMLElement>('li[data-cat]').forEach((li) => {
      li.hidden = active !== '' && li.dataset.cat !== active
    })
  }, [active, ready])

  return (
    <div ref={box} className="be-el-49-filter">
      {ready && (
        <div className="be-el-49-filter__chips" role="group" aria-label="Filter pictures">
          {['', ...categories].map((c) => (
            <button key={c || 'all'} type="button" className="be-el-49-filter__chip" aria-pressed={active === c} onClick={() => setActive(c)}>
              {c || allLabel}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}
