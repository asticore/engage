'use client'

import React, { useState } from 'react'

/**
 * A map embed that loads only when the visitor asks for it.
 *
 * Google's embed pulls in about 500 KB of scripts and 500 KB of map tiles, which PageSpeed (22 Nov 2026) counted
 * against every page with a map, even when nobody looked at it. Until the button is pressed this renders a light
 * placeholder with the place name, so the page paints at once and no third-party request is made.
 */
export const MapFacade = ({ src, title, label, height, preview, directions }: { src: string; title: string; label: string; height: number; preview?: string; directions?: string }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="el-map" style={{ height }}>
      {open && src ? (
        <iframe src={src} title={title} referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      ) : (
        <button type="button" className="el-map__facade" onClick={() => (src ? setOpen(true) : directions ? window.open(directions, '_blank', 'noopener') : undefined)} aria-label={`Show map: ${label}`}>
          {preview && <img className="el-map__preview" src={preview} alt="" loading="lazy" decoding="async" />}
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span className="el-map__label">{label}</span>
          <span className="el-map__action">{src ? 'Show map' : 'Open map'}</span>
        </button>
      )}
      {directions && (
        <a className="el-map__directions" href={directions} target="_blank" rel="noopener noreferrer">
          Get directions
        </a>
      )}
      <noscript>{directions ? <a href={directions}>{label}</a> : <span>{label}</span>}</noscript>
    </div>
  )
}
