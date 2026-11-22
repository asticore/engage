'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * Video popup: a poster (or plain play tile) that opens the video in a modal dialog. The video is only
 * added to the page when the dialog opens, so nothing loads until the visitor asks. Escape and the close
 * button close it, focus returns to the play button, and the video stops when it closes.
 */
export const VideoPopup: React.FC<{ kind: 'file' | 'embed'; src: string; poster?: string; title: string }> = ({ kind, src, poster, title }) => {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const embedSrc = kind === 'embed' ? `${src}${src.includes('?') ? '&' : '?'}autoplay=1` : src

  return (
    <>
      <button
        ref={opener}
        type="button"
        className="el-video-popup__tile"
        aria-haspopup="dialog"
        aria-label={`Play video: ${title}`}
        style={poster ? { backgroundImage: `url(${poster})` } : undefined}
        onClick={() => setOpen(true)}
      >
        <span className="el-video-popup__play" aria-hidden="true">▶</span>
      </button>
      <dialog
        ref={dialog}
        className="el-video-popup__dialog"
        aria-label={title}
        onClose={() => { setOpen(false); opener.current?.focus() }}
        onClick={(e) => { if (e.target === dialog.current) setOpen(false) }}
      >
        <button type="button" className="el-video-popup__close" aria-label="Close video" onClick={() => setOpen(false)}>×</button>
        {open && (kind === 'file' ? (
          <video src={embedSrc} poster={poster} controls autoPlay playsInline aria-label={title} />
        ) : (
          <iframe
            src={embedSrc}
            title={title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ))}
      </dialog>
    </>
  )
}
