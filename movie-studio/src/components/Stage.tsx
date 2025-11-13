import { useEffect, useMemo, useRef } from 'react'
import type {
  Clip,
  Scene,
  TextClip,
  ShapeClip,
  ImageClip,
  VideoClip,
  TransformSnapshot,
} from '../types'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const interpolateTransform = (
  start: TransformSnapshot,
  end: TransformSnapshot,
  progress: number,
) => ({
  x: lerp(start.x, end.x, progress),
  y: lerp(start.y, end.y, progress),
  scale: lerp(start.scale, end.scale, progress),
  rotation: lerp(start.rotation, end.rotation, progress),
  opacity: lerp(start.opacity, end.opacity, progress),
})

export interface StageProps {
  scene: Scene
  currentTime: number
  isPlaying: boolean
  selectedClipId: string | null
  onSelectClip: (clipId: string | null) => void
}

const isVisualClip = (
  clip: Clip,
): clip is TextClip | ShapeClip | ImageClip | VideoClip => clip.type !== 'voice'

export const Stage = ({
  scene,
  currentTime,
  isPlaying,
  selectedClipId,
  onSelectClip,
}: StageProps) => {
  const videoRefs = useRef(new Map<string, HTMLVideoElement>())

  const activeClips = useMemo(
    () =>
      scene.clips
        .filter(isVisualClip)
        .filter((clip) => currentTime >= clip.start && currentTime <= clip.end)
        .sort((a, b) => a.zIndex - b.zIndex),
    [scene.clips, currentTime],
  )

  useEffect(() => {
    const cleanup: string[] = []
    return () => {
      cleanup.forEach((clipId) => {
        const element = videoRefs.current.get(clipId)
        if (element) {
          element.pause()
        }
      })
    }
  }, [])

  useEffect(() => {
    activeClips.forEach((clip) => {
      if (clip.type !== 'video') return
      const element = videoRefs.current.get(clip.id)
      if (!element) return

      element.playbackRate = clip.playbackRate
      element.loop = clip.loop
      element.muted = clip.muted
      element.volume = clip.volume

      const relativeTime = currentTime - clip.start
      const clipDuration = Math.max(clip.end - clip.start, 0.001)

      if (relativeTime < 0 || relativeTime > clipDuration) {
        if (!element.paused) {
          element.pause()
        }
        if (relativeTime < 0) {
          element.currentTime = 0
        }
        return
      }

      if (Math.abs(element.currentTime - relativeTime) > 0.1) {
        try {
          element.currentTime = Math.max(0, relativeTime)
        } catch {
          // ignore sync failures
        }
      }

      if (isPlaying) {
        const playPromise = element.play()
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            // Autoplay may fail; keep silent
          })
        }
      } else {
        element.pause()
      }
    })
  }, [activeClips, currentTime, isPlaying])

  return (
    <div
      className="stage"
      style={{ background: scene.background }}
      onClick={() => onSelectClip(null)}
    >
      {scene.gridEnabled && (
        <div className="stage-grid" aria-hidden />
      )}
      {activeClips.map((clip) => {
        const progress = Math.min(
          1,
          Math.max(0, (currentTime - clip.start) / Math.max(clip.end - clip.start, 0.001)),
        )
        const transform = interpolateTransform(clip.startTransform, clip.endTransform, progress)

        const commonStyle: React.CSSProperties = {
          position: 'absolute',
          top: `${transform.y}%`,
          left: `${transform.x}%`,
          transform: `translate(-50%, -50%) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
          opacity: transform.opacity,
          transition: isPlaying ? 'none' : 'transform 120ms linear, opacity 120ms linear',
          boxShadow:
            clip.type === 'image' && clip.shadow
              ? '0 24px 48px rgba(15, 23, 42, 0.4)'
              : 'none',
          cursor: 'pointer',
        }

        const isSelected = clip.id === selectedClipId

        const handleSelect = (event: React.MouseEvent) => {
          event.stopPropagation()
          onSelectClip(clip.id)
        }

        if (clip.type === 'text') {
          return (
            <div
              key={clip.id}
              className={`stage-layer text-layer ${isSelected ? 'selected' : ''}`}
              onClick={handleSelect}
              style={{
                ...commonStyle,
                color: clip.color,
                fontSize: clip.fontSize,
                fontFamily: clip.fontFamily,
                fontWeight: clip.fontWeight,
                textAlign: clip.textAlign,
                background: clip.background,
                padding: clip.padding,
                border: isSelected ? '1px solid rgba(148, 163, 184, 0.8)' : '1px solid transparent',
                borderRadius: 12,
                maxWidth: '60%',
                whiteSpace: 'pre-wrap',
              }}
            >
              {clip.text}
            </div>
          )
        }

        if (clip.type === 'shape') {
          return (
            <div
              key={clip.id}
              className={`stage-layer shape-layer ${isSelected ? 'selected' : ''}`}
              onClick={handleSelect}
              style={{
                ...commonStyle,
                width: `${clip.widthPercent}%`,
                height: `${clip.heightPercent}%`,
                background: clip.fill,
                borderRadius: clip.shape === 'circle' ? '50%' : `${clip.borderRadius}px`,
                border: `${clip.strokeWidth}px solid ${clip.strokeColor}`,
              }}
            />
          )
        }

        if (clip.type === 'image') {
          return (
            <img
              key={clip.id}
              src={clip.src}
              alt={clip.name}
              className={`stage-layer image-layer ${isSelected ? 'selected' : ''}`}
              onClick={handleSelect}
              style={{
                ...commonStyle,
                width: `${clip.widthPercent}%`,
                height: `${clip.heightPercent}%`,
                objectFit: clip.fit,
                borderRadius: `${clip.borderRadius}px`,
                border: isSelected ? '1px solid rgba(148, 163, 184, 0.8)' : '1px solid transparent',
              }}
            />
          )
        }

        if (clip.type === 'video') {
          return (
            <video
              key={clip.id}
              ref={(element) => {
                if (!element) {
                  videoRefs.current.delete(clip.id)
                } else {
                  videoRefs.current.set(clip.id, element)
                }
              }}
              className={`stage-layer video-layer ${isSelected ? 'selected' : ''}`}
              onClick={handleSelect}
              style={{
                ...commonStyle,
                width: `${clip.widthPercent}%`,
                height: `${clip.heightPercent}%`,
                objectFit: clip.fit,
                borderRadius: `${clip.borderRadius}px`,
                border: isSelected ? '1px solid rgba(148, 163, 184, 0.8)' : '1px solid transparent',
                background: 'rgba(15, 23, 42, 0.9)',
              }}
              src={clip.src}
            />
          )
        }

        return null
      })}
    </div>
  )
}
