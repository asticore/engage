'use client'

import React, { cloneElement, useId } from 'react'

import './Tooltip.css'

/**
 * Shared tooltip for icon-only controls and short hints. Unlike a `title=` attribute it shows on
 * keyboard focus and on touch (a tap focuses the control), and the text is linked to the control
 * with aria-describedby so screen readers announce it too. The child must accept aria-describedby
 * (any button, link or input does).
 */
export function Tooltip({
  text,
  children,
  placement = 'top',
  block = false,
}: {
  text: string
  children: React.ReactElement
  placement?: 'top' | 'bottom'
  /** Full-width wrapper, for inputs and selects that must fill their row. */
  block?: boolean
}) {
  const id = useId()
  if (!text) return children
  return (
    <span className={`admin-tip admin-tip--${placement}${block ? ' admin-tip--block' : ''}`}>
      {cloneElement(children as React.ReactElement<Record<string, unknown>>, { 'aria-describedby': id })}
      <span role="tooltip" id={id} className="admin-tip__bubble">
        {text}
      </span>
    </span>
  )
}
