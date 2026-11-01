import { useCallback, useEffect, useRef, useState } from 'react'
import { ANIMATION_DURATION_MS } from '../animation/progress'
import type { ProgressReference } from '../scene/PoetryScene'

export type PlaybackStatus = 'ready' | 'playing' | 'paused' | 'complete'

export interface PlaybackController {
  progress: number
  progressRef: ProgressReference
  status: PlaybackStatus
  playFromStart: () => void
  replay: () => void
  pause: () => void
  resume: () => void
  seek: (progress: number) => void
  reset: () => void
}

export function usePlayback(): PlaybackController {
  const progressRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const lastUiUpdateRef = useRef(0)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<PlaybackStatus>('ready')

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const tick = useCallback((now: number) => {
    const next = Math.min(1, (now - startTimeRef.current) / ANIMATION_DURATION_MS)
    progressRef.current = next

    if (now - lastUiUpdateRef.current >= 50 || next >= 1) {
      lastUiUpdateRef.current = now
      setProgress(next)
    }

    if (next >= 1) {
      frameRef.current = null
      setStatus('complete')
      return
    }

    frameRef.current = requestAnimationFrame(tick)
  }, [])

  const beginAt = useCallback((value: number) => {
    cancelFrame()
    const normalized = Math.min(1, Math.max(0, value))
    progressRef.current = normalized
    setProgress(normalized)
    startTimeRef.current = performance.now() - normalized * ANIMATION_DURATION_MS
    lastUiUpdateRef.current = 0
    setStatus('playing')
    frameRef.current = requestAnimationFrame(tick)
  }, [cancelFrame, tick])

  const playFromStart = useCallback(() => beginAt(0), [beginAt])
  const replay = useCallback(() => beginAt(0), [beginAt])

  const pause = useCallback(() => {
    cancelFrame()
    setProgress(progressRef.current)
    setStatus('paused')
  }, [cancelFrame])

  const resume = useCallback(() => {
    if (progressRef.current >= 1) {
      beginAt(0)
      return
    }
    beginAt(progressRef.current)
  }, [beginAt])

  const seek = useCallback((value: number) => {
    cancelFrame()
    const normalized = Math.min(1, Math.max(0, value))
    progressRef.current = normalized
    setProgress(normalized)
    setStatus(normalized >= 1 ? 'complete' : normalized <= 0 ? 'ready' : 'paused')
  }, [cancelFrame])

  const reset = useCallback(() => {
    cancelFrame()
    progressRef.current = 0
    setProgress(0)
    setStatus('ready')
  }, [cancelFrame])

  useEffect(() => cancelFrame, [cancelFrame])

  return {
    progress,
    progressRef,
    status,
    playFromStart,
    replay,
    pause,
    resume,
    seek,
    reset,
  }
}
