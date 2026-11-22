'use client'

import React, { useEffect } from 'react'

import { startSpark } from '@/components/site/SparkLoader'

/**
 * The editor canvas never runs page effects, but elements that Spark draws (charts, data tables) would be empty
 * without it. This wrapper starts Spark for them and remounts when the element's props change, so the drawing
 * follows what is typed in the panel.
 */
export const SparkCanvasPreview: React.FC<{ signature: string; children: React.ReactNode }> = ({ signature, children }) => {
  useEffect(() => {
    startSpark()
  }, [])
  return <div key={signature}>{children}</div>
}
