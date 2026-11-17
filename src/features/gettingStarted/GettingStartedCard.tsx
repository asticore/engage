/**
 * Client component: getting-started checklist card with progress, items, and manual toggles.
 * Renders at the top of the dashboard.
 */

'use client'

import { AdminLink } from '@/admin/adminRoute/AdminLink'
import React, { useState } from 'react'
import type { ComputedProgress } from './compute'
import { GETTING_STARTED_ITEMS } from './items'
import { CollapsibleCard } from '@/admin/components/CollapsibleCard'

export type GettingStartedCardProps = {
  progress: ComputedProgress
  initialDoneIds: string[]
  onDismiss?: () => void
}

/**
 * Visual progress bar with percent label.
 */
function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="eg-gs-progressContainer">
      <div className="eg-gs-progressBar">
        <div className="eg-gs-progressFill" style={{ width: `${percent}%` }} />
      </div>
      <span className="eg-gs-progressLabel">{percent}%</span>
    </div>
  )
}

/**
 * Single checklist item with link and toggle.
 */
function ChecklistItem({
  id,
  title,
  help,
  href,
  isDone,
  onToggle,
}: {
  id: string
  title: string
  help: string
  href: string
  isDone: boolean
  onToggle: (id: string, done: boolean) => Promise<void>
}) {
  const [isLoading, setIsLoading] = useState(false)

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLoading(true)
    try {
      await onToggle(id, e.target.checked)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="eg-gs-item">
      <div className="eg-gs-itemContent">
        <label className="eg-gs-itemLabel">
          <input
            type="checkbox"
            checked={isDone}
            onChange={handleToggle}
            disabled={isLoading}
            className="eg-gs-itemCheckbox"
          />
          <span className="eg-gs-itemTitle">{title}</span>
        </label>
        <p className="eg-gs-itemHelp">{help}</p>
      </div>
      {!isDone && (
        <AdminLink path={href} className="eg-gs-itemLink">
          Set up
        </AdminLink>
      )}
    </div>
  )
}

/**
 * Main getting-started card component.
 */
export const GettingStartedCard: React.FC<GettingStartedCardProps> = ({
  progress,
  initialDoneIds,
  onDismiss,
}) => {
  const [isDismissed, setIsDismissed] = useState(false)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(initialDoneIds))

  const handleItemToggle = async (id: string, done: boolean) => {
    const newIds = new Set(doneIds)
    if (done) {
      newIds.add(id)
    } else {
      newIds.delete(id)
    }
    setDoneIds(newIds)

    // POST to API
    try {
      await fetch('/api/admin-getting-started', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          done,
        }),
      })
    } catch (error) {
      console.error('Failed to save getting-started state:', error)
      // Revert on error
      const reverted = new Set(doneIds)
      if (done) {
        reverted.delete(id)
      } else {
        reverted.add(id)
      }
      setDoneIds(reverted)
    }
  }

  const handleDismiss = async () => {
    if (onDismiss) {
      onDismiss()
    }
    setIsDismissed(true)
  }

  if (isDismissed || progress.percent === 100) {
    return null
  }

  // The card is a CollapsibleCard (closed by default, remembered per user). Its
  // title is the card heading; the subtitle, progress and dismiss sit in the body.
  return (
    <CollapsibleCard id="home:getting-started" title="Getting started" className="eg-gs-card">
      <div className="eg-gs-header">
        <div className="eg-gs-titleArea">
          <p className="eg-gs-subtitle">
            {progress.done} of {progress.total} tasks complete
          </p>
        </div>
        <div className="eg-gs-controls">
          <button
            onClick={handleDismiss}
            className="eg-gs-dismissBtn"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>

      <ProgressBar percent={progress.percent} />

      <div className="eg-gs-content">
        {Object.entries(progress.byCategory)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, counts]) => (
            <div key={category} className="eg-gs-category">
              <h3 className="eg-gs-categoryTitle">
                {category}
                <span className="eg-gs-categoryCount">
                  {counts.done}/{counts.total}
                </span>
              </h3>
              <div className="eg-gs-items">
                {GETTING_STARTED_ITEMS.filter((item) => item.category === category).map(
                  (item) => (
                    <ChecklistItem
                      key={item.id}
                      {...item}
                      isDone={doneIds.has(item.id)}
                      onToggle={handleItemToggle}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
      </div>
    </CollapsibleCard>
  )
}
