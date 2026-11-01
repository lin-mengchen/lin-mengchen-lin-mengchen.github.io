import { Pause, Play, RotateCcw } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { PlaybackStatus } from '../hooks/usePlayback'

interface TimelineProps {
  progress: number
  status: PlaybackStatus
  disabled: boolean
  onPrimaryAction: () => void
  onReplay: () => void
  onSeek: (value: number) => void
}

const STAGES = [
  { at: 0, label: '原阵' },
  { at: 2 / 12, label: '卷曲' },
  { at: 5 / 12, label: '织形' },
  { at: 9 / 12, label: '成衣' },
]

function primaryLabel(status: PlaybackStatus): string {
  if (status === 'playing') return '暂停'
  if (status === 'paused') return '继续'
  if (status === 'complete') return '再次生成'
  return '生成诗衣'
}

export function Timeline({
  progress,
  status,
  disabled,
  onPrimaryAction,
  onReplay,
  onSeek,
}: TimelineProps) {
  const progressPercent = Math.round(progress * 100)
  const isPlaying = status === 'playing'

  return (
    <footer className="timeline-panel">
      <div className="timeline-actions">
        <button
          type="button"
          className="primary-button"
          onClick={onPrimaryAction}
          disabled={disabled}
        >
          {isPlaying ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
          {primaryLabel(status)}
        </button>
        <button
          type="button"
          className="icon-button replay-button"
          onClick={onReplay}
          disabled={disabled}
          aria-label="从头重播十二秒动画"
          title="从头重播"
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="timeline-track-wrap">
        <div className="stage-labels" aria-hidden="true">
          {STAGES.map((stage) => (
            <span key={stage.label} style={{ left: `${stage.at * 100}%` }}>{stage.label}</span>
          ))}
          <span style={{ left: '100%' }}>环看</span>
        </div>
        <div className="range-wrap" style={{ '--timeline-progress': `${progressPercent}%` } as CSSProperties}>
          <input
            className="timeline-range"
            type="range"
            min="0"
            max="1000"
            value={Math.round(progress * 1000)}
            onChange={(event) => onSeek(Number(event.target.value) / 1000)}
            disabled={disabled}
            aria-label="动画进度"
            aria-valuetext={`${progressPercent}%`}
          />
        </div>
      </div>

      <output className="progress-number" aria-live="off">{String(progressPercent).padStart(2, '0')}<small>%</small></output>
    </footer>
  )
}
