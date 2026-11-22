import React from 'react'

/**
 * Opens the links inside it (pictures linked to their full-size files) in Spark's shared Shine modal with arrows, a
 * counter and keyboard keys (`spark-lightbox`, asticore/spark). Without scripts each link just opens its picture.
 */
export const SparkLightbox: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="spark-lightbox">{children}</div>
