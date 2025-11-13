import { useCallback, useMemo, useReducer } from 'react'
import type { Clip, Scene, VoiceClip, TransformSnapshot } from '../types'
import {
  studioReducer,
  createInitialState,
  createDefaultTransform,
} from '../state/studioState'
import { createId } from '../utils/createId'

const cloneTransform = (transform: TransformSnapshot): TransformSnapshot => ({ ...transform })

const cloneClip = (clip: Clip): Clip => {
  const base = {
    ...clip,
    id: createId(`clip-${clip.type}`),
    name: `${clip.name} Copy`,
    start: clip.start,
    end: clip.end,
    zIndex: clip.zIndex,
  } as Clip

  switch (clip.type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        startTransform: cloneTransform(clip.startTransform),
        endTransform: cloneTransform(clip.endTransform),
        text: clip.text,
        color: clip.color,
        fontSize: clip.fontSize,
        fontFamily: clip.fontFamily,
        fontWeight: clip.fontWeight,
        textAlign: clip.textAlign,
        background: clip.background,
        padding: clip.padding,
      }
    case 'shape':
      return {
        ...base,
        type: 'shape',
        startTransform: cloneTransform(clip.startTransform),
        endTransform: cloneTransform(clip.endTransform),
        shape: clip.shape,
        widthPercent: clip.widthPercent,
        heightPercent: clip.heightPercent,
        fill: clip.fill,
        borderRadius: clip.borderRadius,
        strokeColor: clip.strokeColor,
        strokeWidth: clip.strokeWidth,
      }
    case 'image':
      return {
        ...base,
        type: 'image',
        startTransform: cloneTransform(clip.startTransform),
        endTransform: cloneTransform(clip.endTransform),
        src: clip.src,
        widthPercent: clip.widthPercent,
        heightPercent: clip.heightPercent,
        fit: clip.fit,
        borderRadius: clip.borderRadius,
        shadow: clip.shadow,
      }
    case 'video':
      return {
        ...base,
        type: 'video',
        startTransform: cloneTransform(clip.startTransform),
        endTransform: cloneTransform(clip.endTransform),
        src: clip.src,
        widthPercent: clip.widthPercent,
        heightPercent: clip.heightPercent,
        fit: clip.fit,
        borderRadius: clip.borderRadius,
        volume: clip.volume,
        muted: clip.muted,
        playbackRate: clip.playbackRate,
        loop: clip.loop,
      }
    case 'voice':
      return {
        ...base,
        type: 'voice',
        script: clip.script,
        voiceURI: clip.voiceURI,
        rate: clip.rate,
        pitch: clip.pitch,
        volume: clip.volume,
      }
    default:
      return base
  }
}

export const useStudioState = () => {
  const [state, dispatch] = useReducer(studioReducer, undefined, createInitialState)

  const selectedScene = useMemo<Scene | undefined>(
    () => state.scenes.find((scene) => scene.id === state.selectedSceneId),
    [state.scenes, state.selectedSceneId],
  )

  const selectedClip = useMemo<Clip | undefined>(() => {
    if (!selectedScene || !state.selectedClipId) return undefined
    return selectedScene.clips.find((clip) => clip.id === state.selectedClipId)
  }, [selectedScene, state.selectedClipId])

  const addScene = useCallback(() => {
    const nextIndex = state.scenes.length + 1
    dispatch({ type: 'ADD_SCENE', template: { name: `Scene ${nextIndex}` } })
  }, [state.scenes.length])

  const duplicateScene = useCallback(
    (sceneId: string) => {
      const scene = state.scenes.find((s) => s.id === sceneId)
      if (!scene) return
      const clone: Scene = {
        ...scene,
        id: createId('scene'),
        name: `${scene.name} Copy`,
        clips: scene.clips.map((clip) => cloneClip(clip)),
      }
      dispatch({ type: 'ADD_SCENE', template: clone })
    },
    [state.scenes],
  )

  const removeScene = useCallback((sceneId: string) => {
    dispatch({ type: 'REMOVE_SCENE', sceneId })
  }, [])

  const updateScene = useCallback((sceneId: string, patch: Partial<Scene>) => {
    dispatch({ type: 'UPDATE_SCENE', sceneId, patch })
  }, [])

  const selectScene = useCallback((sceneId: string) => {
    dispatch({ type: 'SELECT_SCENE', sceneId })
  }, [])

  const selectClip = useCallback((clipId: string | null) => {
    dispatch({ type: 'SELECT_CLIP', clipId })
  }, [])

  const removeClip = useCallback(
    (sceneId: string, clipId: string) => {
      dispatch({ type: 'REMOVE_CLIP', sceneId, clipId })
    },
    [],
  )

  const updateClip = useCallback(
    (sceneId: string, clipId: string, patch: Partial<Clip>) => {
      dispatch({ type: 'UPDATE_CLIP', sceneId, clipId, patch })
    },
    [],
  )

  const setCurrentTime = useCallback((time: number) => {
    dispatch({ type: 'SET_CURRENT_TIME', time })
  }, [])

  const setPlaying = useCallback((value: boolean) => {
    dispatch({ type: 'SET_IS_PLAYING', value })
  }, [])

  const setLooping = useCallback((value: boolean) => {
    dispatch({ type: 'SET_LOOP', value })
  }, [])

  const bumpClipZ = useCallback((sceneId: string, clipId: string, delta: number) => {
    dispatch({ type: 'BUMP_CLIP_Z', sceneId, clipId, delta })
  }, [])

  const duplicateClip = useCallback(
    (sceneId: string, clipId: string) => {
      const scene = state.scenes.find((s) => s.id === sceneId)
      if (!scene) return
      const clip = scene.clips.find((item) => item.id === clipId)
      if (!clip) return
      const clone = cloneClip(clip)
      const maxZ = scene.clips.reduce((acc, item) => Math.max(acc, item.zIndex), 0)
      clone.zIndex = maxZ + 10
      dispatch({ type: 'ADD_CLIP', sceneId, clip: clone })
    },
    [state.scenes],
  )

  const addTextClip = useCallback(
    (sceneId: string) => {
      const nextZ = ((selectedScene?.clips.length ?? 0) + 1) * 10
      const clip: Clip = {
        id: createId('clip-text'),
        name: 'Title',
        type: 'text',
        start: 0,
        end: 4,
        zIndex: nextZ,
        startTransform: createDefaultTransform(),
        endTransform: { ...createDefaultTransform(), opacity: 0 },
        text: 'Your story starts here',
        color: '#f8fafc',
        fontSize: 36,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 600,
        textAlign: 'center',
        background: 'rgba(15, 23, 42, 0.3)',
        padding: 16,
      }
      dispatch({ type: 'ADD_CLIP', sceneId, clip })
    },
    [dispatch, selectedScene?.clips.length],
  )

  const addShapeClip = useCallback(
    (sceneId: string) => {
      const nextZ = ((selectedScene?.clips.length ?? 0) + 1) * 10
      const clip: Clip = {
        id: createId('clip-shape'),
        name: 'Shape',
        type: 'shape',
        start: 0,
        end: 5,
        zIndex: nextZ,
        startTransform: {
          ...createDefaultTransform(),
          scale: 0.3,
        },
        endTransform: {
          ...createDefaultTransform(),
          scale: 0.6,
          rotation: 15,
        },
        shape: 'rectangle',
        widthPercent: 30,
        heightPercent: 20,
        fill: '#38bdf8',
        borderRadius: 24,
        strokeColor: 'rgba(14, 165, 233, 0.6)',
        strokeWidth: 2,
      }
      dispatch({ type: 'ADD_CLIP', sceneId, clip })
    },
    [dispatch, selectedScene?.clips.length],
  )

  const addImageClip = useCallback(
    (sceneId: string, src: string, label = 'Image') => {
      const nextZ = ((selectedScene?.clips.length ?? 0) + 1) * 10
      const clip: Clip = {
        id: createId('clip-image'),
        name: label,
        type: 'image',
        start: 0,
        end: 6,
        zIndex: nextZ,
        startTransform: {
          ...createDefaultTransform(),
          scale: 0.5,
        },
        endTransform: {
          ...createDefaultTransform(),
          scale: 0.5,
        },
        src,
        widthPercent: 50,
        heightPercent: 60,
        fit: 'cover',
        borderRadius: 12,
        shadow: true,
      }
      dispatch({ type: 'ADD_CLIP', sceneId, clip })
    },
    [dispatch, selectedScene?.clips.length],
  )

  const addVideoClip = useCallback(
    (sceneId: string, src: string, name = 'Video') => {
      const nextZ = ((selectedScene?.clips.length ?? 0) + 1) * 10
      const clip: Clip = {
        id: createId('clip-video'),
        name,
        type: 'video',
        start: 0,
        end: 8,
        zIndex: nextZ,
        startTransform: {
          ...createDefaultTransform(),
          scale: 0.6,
        },
        endTransform: {
          ...createDefaultTransform(),
          scale: 0.6,
        },
        src,
        widthPercent: 60,
        heightPercent: 60,
        fit: 'contain',
        borderRadius: 16,
        volume: 0.8,
        muted: false,
        playbackRate: 1,
        loop: false,
      }
      dispatch({ type: 'ADD_CLIP', sceneId, clip })
    },
    [dispatch, selectedScene?.clips.length],
  )

  const addVoiceClip = useCallback(
    (sceneId: string, script = 'Once upon a time, AI met cinema.') => {
      const nextZ = ((selectedScene?.clips.length ?? 0) + 1) * 10
      const clip: Clip = {
        id: createId('clip-voice'),
        name: 'Voiceover',
        type: 'voice',
        start: 0,
        end: Math.max(4, Math.min(10, script.split(/\s+/).length / 2)),
        zIndex: nextZ,
        script,
        voiceURI: null,
        rate: 1,
        pitch: 1,
        volume: 1,
      } as VoiceClip
      dispatch({ type: 'ADD_CLIP', sceneId, clip })
    },
    [dispatch, selectedScene?.clips.length],
  )

  return {
    state,
    dispatch,
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
  }
}
