export type ClipType = 'text' | 'shape' | 'image' | 'video' | 'voice'

export interface TransformSnapshot {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

export interface BaseClip {
  id: string
  name: string
  type: ClipType
  /**
   * Start time in seconds relative to scene timeline
   */
  start: number
  /**
   * End time in seconds relative to scene timeline
   */
  end: number
  /**
   * Controls layer stacking (higher values appear on top)
   */
  zIndex: number
}

export interface VisualClipBase extends BaseClip {
  type: 'text' | 'shape' | 'image' | 'video'
  startTransform: TransformSnapshot
  endTransform: TransformSnapshot
}

export interface TextClip extends VisualClipBase {
  type: 'text'
  text: string
  color: string
  fontSize: number
  fontFamily: string
  fontWeight: number
  textAlign: 'left' | 'center' | 'right'
  background: string
  padding: number
}

export type ShapeKind = 'rectangle' | 'circle'

export interface ShapeClip extends VisualClipBase {
  type: 'shape'
  shape: ShapeKind
  widthPercent: number
  heightPercent: number
  fill: string
  borderRadius: number
  strokeColor: string
  strokeWidth: number
}

export interface ImageClip extends VisualClipBase {
  type: 'image'
  src: string
  widthPercent: number
  heightPercent: number
  fit: 'cover' | 'contain'
  borderRadius: number
  shadow: boolean
}

export interface VideoClip extends VisualClipBase {
  type: 'video'
  src: string
  widthPercent: number
  heightPercent: number
  fit: 'cover' | 'contain'
  borderRadius: number
  volume: number
  muted: boolean
  playbackRate: number
  loop: boolean
}

export interface VoiceClip extends BaseClip {
  type: 'voice'
  script: string
  voiceURI: string | null
  rate: number
  pitch: number
  volume: number
}

export type Clip = TextClip | ShapeClip | ImageClip | VideoClip | VoiceClip

export interface Scene {
  id: string
  name: string
  duration: number
  background: string
  gridEnabled: boolean
  clips: Clip[]
}

export interface StudioState {
  scenes: Scene[]
  selectedSceneId: string
  selectedClipId: string | null
  isPlaying: boolean
  currentTime: number
  looping: boolean
}
