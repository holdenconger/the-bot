import './App.css'
import { useEffect, useRef } from 'react'
import { SceneSidebar } from './components/SceneSidebar'
import { ClipLibrary } from './components/ClipLibrary'
import { Stage } from './components/Stage'
import { Timeline } from './components/Timeline'
import { PlaybackControls } from './components/PlaybackControls'
import { Inspector } from './components/Inspector'
import { useStudioState } from './hooks/useStudioState'
import { useSpeechVoices } from './hooks/useSpeechVoices'
import type { Clip, VoiceClip } from './types'

function App() {
  const {
    state,
    selectedScene,
    selectedClip,
    addScene,
    duplicateScene,
    removeScene,
    updateScene,
    selectScene,
    selectClip,
    removeClip,
    updateClip,
    addTextClip,
    addShapeClip,
    addImageClip,
    addVideoClip,
    addVoiceClip,
    setCurrentTime,
    setPlaying,
    setLooping,
    bumpClipZ,
    duplicateClip,
  } = useStudioState()
  const { voices, supported: voiceSupported } = useSpeechVoices()

  const rafRef = useRef<number | undefined>(undefined)
  const lastTimestampRef = useRef<number | undefined>(undefined)
  const currentTimeRef = useRef(state.currentTime)
  const spokenVoiceClipsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    currentTimeRef.current = state.currentTime
  }, [state.currentTime])

  useEffect(() => {
    if (!state.isPlaying || !selectedScene) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = undefined
      }
      lastTimestampRef.current = undefined
      return
    }

    const tick = (timestamp: number) => {
      if (lastTimestampRef.current === undefined) {
        lastTimestampRef.current = timestamp
      }
      const delta = (timestamp - lastTimestampRef.current) / 1000
      lastTimestampRef.current = timestamp

      const sceneDuration = Math.max(selectedScene.duration, 0.001)
      let nextTime = currentTimeRef.current + delta

      if (nextTime >= sceneDuration) {
        if (state.looping) {
          nextTime = nextTime % sceneDuration
          spokenVoiceClipsRef.current.clear()
        } else {
          nextTime = sceneDuration
          setCurrentTime(nextTime)
          currentTimeRef.current = nextTime
          setPlaying(false)
          return
        }
      }

      currentTimeRef.current = nextTime
      setCurrentTime(nextTime)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = undefined
      }
    }
  }, [state.isPlaying, selectedScene?.id, state.looping, setCurrentTime, setPlaying, selectedScene])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(() => {
    if (!voiceSupported || !selectedScene) {
      spokenVoiceClipsRef.current.clear()
      return
    }

    if (!state.isPlaying) {
      window.speechSynthesis.cancel()
      spokenVoiceClipsRef.current.clear()
      return
    }

    const voiceClips = selectedScene.clips.filter(
      (clip): clip is VoiceClip => clip.type === 'voice',
    )

    voiceClips.forEach((clip) => {
      if (state.currentTime >= clip.start && state.currentTime <= clip.end) {
        if (!spokenVoiceClipsRef.current.has(clip.id)) {
          const utterance = new SpeechSynthesisUtterance(clip.script)
          utterance.rate = clip.rate
          utterance.pitch = clip.pitch
          utterance.volume = clip.volume
          if (clip.voiceURI) {
            const voice = voices.find((voiceOption) => voiceOption.voiceURI === clip.voiceURI)
            if (voice) {
              utterance.voice = window.speechSynthesis.getVoices().find(
                (native) => native.voiceURI === voice.voiceURI,
              ) ?? null
            }
          }
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(utterance)
          spokenVoiceClipsRef.current.add(clip.id)
        }
      } else if (state.currentTime < clip.start) {
        spokenVoiceClipsRef.current.delete(clip.id)
      }
    })
  }, [state.currentTime, state.isPlaying, selectedScene, voices, voiceSupported])

  const handleStop = () => {
    setPlaying(false)
    setCurrentTime(0)
    currentTimeRef.current = 0
    spokenVoiceClipsRef.current.clear()
    if (voiceSupported) {
      window.speechSynthesis.cancel()
    }
  }

  const handleSeek = (time: number) => {
    setCurrentTime(time)
    currentTimeRef.current = time
    if (voiceSupported) {
      window.speechSynthesis.cancel()
      spokenVoiceClipsRef.current.clear()
    }
  }

  const handleUpdateClip = (clip: Clip, patch: Partial<Clip>) => {
    if (!selectedScene) return
    updateClip(selectedScene.id, clip.id, patch)
  }

  const handleRemoveClip = (clipId: string) => {
    if (!selectedScene) return
    const clipToRemove = selectedScene.clips.find((clip) => clip.id === clipId)
    if (clipToRemove && clipToRemove.type === 'video' && clipToRemove.src.startsWith('blob:')) {
      URL.revokeObjectURL(clipToRemove.src)
    }
    removeClip(selectedScene.id, clipId)
  }

  const handleDuplicateClip = (clipId: string) => {
    if (!selectedScene) return
    duplicateClip(selectedScene.id, clipId)
  }

  const handleBumpZ = (clipId: string, delta: number) => {
    if (!selectedScene) return
    bumpClipZ(selectedScene.id, clipId, delta)
  }

  const handleAddText = () => selectedScene && addTextClip(selectedScene.id)
  const handleAddShape = () => selectedScene && addShapeClip(selectedScene.id)
  const handleAddVoice = () => selectedScene && addVoiceClip(selectedScene.id)
  const handleAddImage = (src: string, name?: string) =>
    selectedScene && addImageClip(selectedScene.id, src, name ?? 'Image')
  const handleAddVideo = (src: string, name?: string) =>
    selectedScene && addVideoClip(selectedScene.id, src, name ?? 'Video')

  const handleRemoveScene = (sceneId: string) => {
    const scene = state.scenes.find((item) => item.id === sceneId)
    scene?.clips.forEach((clip) => {
      if (clip.type === 'video' && clip.src.startsWith('blob:')) {
        URL.revokeObjectURL(clip.src)
      }
    })
    removeScene(sceneId)
  }

  return (
    <div className="app-shell">
      <SceneSidebar
        scenes={state.scenes}
        selectedSceneId={state.selectedSceneId}
        onSelectScene={selectScene}
        onAddScene={addScene}
        onDuplicateScene={duplicateScene}
        onRemoveScene={handleRemoveScene}
        onUpdateScene={updateScene}
      />
      <div className="main-column">
        <ClipLibrary
          onAddText={handleAddText}
          onAddShape={handleAddShape}
          onAddVoice={handleAddVoice}
          onAddImage={handleAddImage}
          onAddVideo={handleAddVideo}
        />
        <div className="stage-panel">
          {selectedScene ? (
            <Stage
              scene={selectedScene}
              currentTime={state.currentTime}
              isPlaying={state.isPlaying}
              selectedClipId={state.selectedClipId}
              onSelectClip={selectClip}
            />
          ) : (
            <div className="empty-stage">Create or select a scene to begin.</div>
          )}
        </div>
        {selectedScene && (
          <div className="timeline-panel">
            <PlaybackControls
              isPlaying={state.isPlaying}
              looping={state.looping}
              currentTime={state.currentTime}
              duration={selectedScene.duration}
              onTogglePlay={() => setPlaying(!state.isPlaying)}
              onStop={handleStop}
              onSeek={handleSeek}
              onToggleLoop={() => setLooping(!state.looping)}
            />
            <Timeline
              scene={selectedScene}
              currentTime={state.currentTime}
              selectedClipId={state.selectedClipId}
              onSelectClip={selectClip}
              onSetCurrentTime={handleSeek}
            />
          </div>
        )}
      </div>
      <Inspector
        scene={selectedScene}
        clip={selectedClip}
        voices={voices}
        voiceSupported={voiceSupported}
        onUpdateClip={handleUpdateClip}
        onRemoveClip={handleRemoveClip}
        onDuplicateClip={handleDuplicateClip}
        onBumpZ={handleBumpZ}
      />
    </div>
  )
}

export default App
