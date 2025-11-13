interface PlaybackControlsProps {
  isPlaying: boolean
  looping: boolean
  currentTime: number
  duration: number
  onTogglePlay: () => void
  onStop: () => void
  onSeek: (time: number) => void
  onToggleLoop: () => void
}

export const PlaybackControls = ({
  isPlaying,
  looping,
  currentTime,
  duration,
  onTogglePlay,
  onStop,
  onSeek,
  onToggleLoop,
}: PlaybackControlsProps) => {
  const safeDuration = Math.max(duration, 0.001)
  return (
    <div className="playback-controls">
      <div className="control-group">
        <button onClick={onTogglePlay} className="control-btn primary">
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={onStop} className="control-btn">
          Stop
        </button>
        <button onClick={onToggleLoop} className={`control-btn ${looping ? 'active' : ''}`}>
          Loop {looping ? 'On' : 'Off'}
        </button>
      </div>
      <div className="scrubber">
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.01}
          value={Math.min(currentTime, safeDuration)}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <div className="scrubber-labels">
          <span>{currentTime.toFixed(2)}s</span>
          <span>{duration.toFixed(2)}s</span>
        </div>
      </div>
    </div>
  )
}
