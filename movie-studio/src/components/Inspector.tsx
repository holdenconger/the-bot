import type { Clip, Scene, ShapeClip, ImageClip, VideoClip, TransformSnapshot } from '../types'
import type { SpeechVoice } from '../hooks/useSpeechVoices'

export interface InspectorProps {
  scene: Scene | undefined
  clip: Clip | undefined
  voices: SpeechVoice[]
  voiceSupported: boolean
  onUpdateClip: (clip: Clip, patch: Partial<Clip>) => void
  onRemoveClip: (clipId: string) => void
  onDuplicateClip: (clipId: string) => void
  onBumpZ: (clipId: string, delta: number) => void
}

const renderTransformInputs = (
  label: string,
  transform: TransformSnapshot,
  onChange: (patch: Partial<TransformSnapshot>) => void,
) => (
  <div className="transform-group">
    <h4>{label}</h4>
    <div className="transform-grid">
      <label>
        X (%)
        <input
          type="number"
          value={transform.x}
          onChange={(event) => onChange({ x: Number(event.target.value) })}
        />
      </label>
      <label>
        Y (%)
        <input
          type="number"
          value={transform.y}
          onChange={(event) => onChange({ y: Number(event.target.value) })}
        />
      </label>
      <label>
        Scale
        <input
          type="number"
          step={0.1}
          value={transform.scale}
          onChange={(event) => onChange({ scale: Number(event.target.value) })}
        />
      </label>
      <label>
        Rotation°
        <input
          type="number"
          value={transform.rotation}
          onChange={(event) => onChange({ rotation: Number(event.target.value) })}
        />
      </label>
      <label>
        Opacity
        <input
          type="number"
          step={0.1}
          min={0}
          max={1}
          value={transform.opacity}
          onChange={(event) => onChange({ opacity: Number(event.target.value) })}
        />
      </label>
    </div>
  </div>
)

export const Inspector = ({
  scene,
  clip,
  voices,
  voiceSupported,
  onUpdateClip,
  onRemoveClip,
  onDuplicateClip,
  onBumpZ,
}: InspectorProps) => {
  type VisualClip = Extract<Clip, { type: 'text' | 'shape' | 'image' | 'video' }>

  if (!scene) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p>Select a scene to start crafting your story.</p>
      </aside>
    )
  }

  if (!clip) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p>Select a layer on the timeline to fine-tune its animation, style, or voice.</p>
      </aside>
    )
  }

  const duration = Math.max(clip.end - clip.start, 0.1)

  const handleTimingChange = (field: 'start' | 'end') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (field === 'start') {
      const nextStart = Math.max(0, Math.min(value, clip.end - 0.1))
      onUpdateClip(clip, { start: nextStart })
    } else {
      const nextEnd = Math.max(clip.start + 0.1, Math.min(value, scene.duration))
      onUpdateClip(clip, { end: nextEnd })
    }
  }

  const visualClip: VisualClip | null = clip.type === 'voice' ? null : (clip as VisualClip)

  const updateStartTransform = (patch: Partial<TransformSnapshot>) => {
    if (!visualClip) return
    const transform = { ...visualClip.startTransform, ...patch }
    onUpdateClip(visualClip, { startTransform: transform } as Partial<Clip>)
  }

  const updateEndTransform = (patch: Partial<TransformSnapshot>) => {
    if (!visualClip) return
    const transform = { ...visualClip.endTransform, ...patch }
    onUpdateClip(visualClip, { endTransform: transform } as Partial<Clip>)
  }

  const handleRemove = () => onRemoveClip(clip.id)
  const handleDuplicate = () => onDuplicateClip(clip.id)

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <h2>{clip.name}</h2>
        <div className="inspector-actions">
          <button onClick={handleDuplicate}>Duplicate</button>
          <button onClick={() => onBumpZ(clip.id, 10)}>Bring Forward</button>
          <button onClick={() => onBumpZ(clip.id, -10)}>Send Back</button>
          <button onClick={handleRemove} className="danger">
            Remove
          </button>
        </div>
      </div>
      <div className="inspector-section">
        <h3>Timing</h3>
        <div className="timing-grid">
          <label>
            Start (s)
            <input type="number" step={0.1} value={clip.start} onChange={handleTimingChange('start')} />
          </label>
          <label>
            End (s)
            <input type="number" step={0.1} value={clip.end} onChange={handleTimingChange('end')} />
          </label>
          <label>
            Duration
            <input type="number" value={duration.toFixed(2)} readOnly />
          </label>
        </div>
      </div>

      {visualClip && (
        <div className="inspector-section">
          <h3>Motion</h3>
          {renderTransformInputs('Intro Pose', visualClip.startTransform, updateStartTransform)}
          {renderTransformInputs('Outro Pose', visualClip.endTransform, updateEndTransform)}
        </div>
      )}

      {clip.type === 'text' && (
        <div className="inspector-section">
          <h3>Text Style</h3>
          <label>
            Content
            <textarea
              value={clip.text}
              onChange={(event) => onUpdateClip(clip, { text: event.target.value })}
            />
          </label>
          <label>
            Font Size
            <input
              type="number"
              value={clip.fontSize}
              onChange={(event) => onUpdateClip(clip, { fontSize: Number(event.target.value) })}
            />
          </label>
          <label>
            Font Weight
            <input
              type="number"
              value={clip.fontWeight}
              onChange={(event) => onUpdateClip(clip, { fontWeight: Number(event.target.value) })}
            />
          </label>
          <label>
            Color
            <input
              type="color"
              value={clip.color}
              onChange={(event) => onUpdateClip(clip, { color: event.target.value })}
            />
          </label>
          <label>
            Background
            <input
              type="color"
              value={clip.background}
              onChange={(event) => onUpdateClip(clip, { background: event.target.value })}
            />
          </label>
          <label>
            Padding (px)
            <input
              type="number"
              value={clip.padding}
              onChange={(event) => onUpdateClip(clip, { padding: Number(event.target.value) })}
            />
          </label>
        </div>
      )}

      {clip.type === 'shape' && (
        <div className="inspector-section">
          <h3>Shape</h3>
          <label>
            Kind
            <select
              value={clip.shape}
              onChange={(event) => onUpdateClip(clip, { shape: event.target.value as ShapeClip['shape'] })}
            >
              <option value="rectangle">Rectangle</option>
              <option value="circle">Circle</option>
            </select>
          </label>
          <label>
            Fill
            <input
              type="color"
              value={clip.fill}
              onChange={(event) => onUpdateClip(clip, { fill: event.target.value })}
            />
          </label>
          <label>
            Width (%)
            <input
              type="number"
              value={clip.widthPercent}
              onChange={(event) => onUpdateClip(clip, { widthPercent: Number(event.target.value) })}
            />
          </label>
          <label>
            Height (%)
            <input
              type="number"
              value={clip.heightPercent}
              onChange={(event) => onUpdateClip(clip, { heightPercent: Number(event.target.value) })}
            />
          </label>
          {clip.shape === 'rectangle' && (
            <label>
              Corner Radius
              <input
                type="number"
                value={clip.borderRadius}
                onChange={(event) =>
                  onUpdateClip(clip, { borderRadius: Number(event.target.value) })
                }
              />
            </label>
          )}
        </div>
      )}

      {clip.type === 'image' && (
        <div className="inspector-section">
          <h3>Image</h3>
          <label>
            Width (%)
            <input
              type="number"
              value={clip.widthPercent}
              onChange={(event) => onUpdateClip(clip, { widthPercent: Number(event.target.value) })}
            />
          </label>
          <label>
            Height (%)
            <input
              type="number"
              value={clip.heightPercent}
              onChange={(event) => onUpdateClip(clip, { heightPercent: Number(event.target.value) })}
            />
          </label>
          <label>
            Fit
            <select
              value={clip.fit}
              onChange={(event) => onUpdateClip(clip, { fit: event.target.value as ImageClip['fit'] })}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={clip.shadow}
              onChange={(event) => onUpdateClip(clip, { shadow: event.target.checked })}
            />
            Drop shadow
          </label>
        </div>
      )}

      {clip.type === 'video' && (
        <div className="inspector-section">
          <h3>Video</h3>
          <label>
            Width (%)
            <input
              type="number"
              value={clip.widthPercent}
              onChange={(event) => onUpdateClip(clip, { widthPercent: Number(event.target.value) })}
            />
          </label>
          <label>
            Height (%)
            <input
              type="number"
              value={clip.heightPercent}
              onChange={(event) => onUpdateClip(clip, { heightPercent: Number(event.target.value) })}
            />
          </label>
          <label>
            Fit
            <select
              value={clip.fit}
              onChange={(event) => onUpdateClip(clip, { fit: event.target.value as VideoClip['fit'] })}
            >
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
            </select>
          </label>
          <label>
            Volume
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={clip.volume}
              onChange={(event) => onUpdateClip(clip, { volume: Number(event.target.value) })}
            />
          </label>
          <label>
            Playback Rate
            <input
              type="number"
              step={0.1}
              value={clip.playbackRate}
              onChange={(event) =>
                onUpdateClip(clip, { playbackRate: Number(event.target.value) })
              }
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={clip.loop}
              onChange={(event) => onUpdateClip(clip, { loop: event.target.checked })}
            />
            Loop video
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={clip.muted}
              onChange={(event) => onUpdateClip(clip, { muted: event.target.checked })}
            />
            Mute
          </label>
        </div>
      )}

      {clip.type === 'voice' && (
        <div className="inspector-section">
          <h3>AI Voiceover</h3>
          {!voiceSupported && (
            <p className="warning">
              Speech synthesis is not supported in this browser. Try Chrome or Edge for AI voice playback.
            </p>
          )}
          <label>
            Script
            <textarea
              value={clip.script}
              onChange={(event) => onUpdateClip(clip, { script: event.target.value })}
            />
          </label>
          <label>
            Voice
            <select
              value={clip.voiceURI ?? ''}
              onChange={(event) =>
                onUpdateClip(clip, { voiceURI: event.target.value || null })
              }
            >
              <option value="">Auto (browser default)</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} — {voice.lang}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rate
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={clip.rate}
              onChange={(event) => onUpdateClip(clip, { rate: Number(event.target.value) })}
            />
          </label>
          <label>
            Pitch
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={clip.pitch}
              onChange={(event) => onUpdateClip(clip, { pitch: Number(event.target.value) })}
            />
          </label>
          <label>
            Volume
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={clip.volume}
              onChange={(event) => onUpdateClip(clip, { volume: Number(event.target.value) })}
            />
          </label>
        </div>
      )}
    </aside>
  )
}
