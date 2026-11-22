'use client'

import React, { useId, useState } from 'react'

/**
 * "Read more" option: clamps its content to a height and offers an expand and collapse button.
 * Rendered clamped on the server; the noscript rule shows everything when JavaScript is off.
 */
export const CollapseBox: React.FC<{ height: number; more?: string; less?: string; children: React.ReactNode }> = ({ height, more, less, children }) => {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="be-collapse" data-open={open ? 'true' : 'false'}>
      <noscript>
        <style>{'.be-collapse__body{max-height:none!important}.be-collapse__btn{display:none}'}</style>
      </noscript>
      <div id={id} className="be-collapse__body" style={open ? undefined : { maxHeight: `${height}px` }}>
        {children}
      </div>
      <button type="button" className="be-collapse__btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        {open ? less || 'Show less' : more || 'Read more'}
      </button>
    </div>
  )
}
