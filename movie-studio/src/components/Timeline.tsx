import { useMemo, useRef } from 'react'
import type { Clip, Scene } from '../types'

export interface TimelineProps {
  scene: Scene
  currentTime: number
  selectedClipId: string | null
  onSelectClip: (clipId: string | null) => void
  onSetCurrentTime: (time: number) => void
}

const clipColors: Record<Clip['type'], string> = {
  text: 'rgba(96, 165, 250, 0.8)',
  shape: 'rgba(248, 113, 113, 0.8)',
  image: 'rgba(190, 242, 100, 0.8)',
  video: 'rgba(129, 140, 248, 0.8)',
  voice: 'rgba(248, 250, 252, 0.8)',
}

export const Timeline = ({
  scene,
  currentTime,
  selectedClipId,
  onSelectClip,
  onSetCurrentTime,
}: TimelineProps) => {
  const rulerRef = useRef<HTMLDivElement>(null)
  const safeDuration = Math.max(scene.duration, 0.001)
  const laneHeight = 48
  const trackHeight = Math.max(scene.clips.length, 1) * laneHeight + 24

  const ticks = useMemo(() => {
    const duration = Math.max(scene.duration, 1)
    const tickCount = Math.min(20, Math.ceil(duration))
    return Array.from({ length: tickCount + 1 }).map((_, index) => ({
      label: `${index}s`,
      position: (index / duration) * 100,
    }))
  }, [scene.duration])

  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = rulerRef.current?.getBoundingClientRect()
    if (!bounds) return
    const ratio = (event.clientX - bounds.left) / bounds.width
    const time = Math.max(0, Math.min(scene.duration, ratio * scene.duration))
    onSetCurrentTime(time)
  }

  return (
    <div className="timeline">
      <div className="timeline-header">
        <span className="timeline-title">Timeline</span>
        <span className="timeline-duration">{currentTime.toFixed(2)}s / {scene.duration}s</span>
      </div>
      <div
        className="timeline-ruler"
        ref={rulerRef}
        onClick={handleTimelineClick}
        role="presentation"
      >
        {ticks.map((tick) => (
          <div
            key={tick.label}
            className="timeline-tick"
            style={{ left: `${tick.position}%` }}
          >
            <span>{tick.label}</span>
          </div>
        ))}
        <div
          className="timeline-playhead"
          style={{ left: `${(currentTime / safeDuration) * 100}%` }}
        />
      </div>
      <div className="timeline-tracks" style={{ height: trackHeight }}>
        {scene.clips
          .slice()
          .sort((a, b) => a.start - b.start)
          .map((clip, index) => {
              const duration = Math.max(clip.end - clip.start, 0.1)
              const startPercent = (clip.start / safeDuration) * 100
              const widthPercent = (duration / safeDuration) * 100
            const isSelected = clip.id === selectedClipId
            return (
              <button
                key={clip.id}
                className={`timeline-clip ${clip.type} ${isSelected ? 'selected' : ''}`}
                style={{
                  left: `${startPercent}%`,
                  width: `${widthPercent}%`,
                  top: index * laneHeight,
                  background: clipColors[clip.type],
                }}
                onClick={() => onSelectClip(clip.id)}
              >
                <span className="clip-label">{clip.name}</span>
                <span className="clip-time">
                  {clip.start.toFixed(1)}s → {clip.end.toFixed(1)}s
                </span>
              </button>
            )
          })}
      </div>
    </div>
  )
}
