import type { Clip, Scene, StudioState, TransformSnapshot, VoiceClip } from '../types'
import { createId } from '../utils/createId'

export type StudioAction =
  | { type: 'SELECT_SCENE'; sceneId: string }
  | { type: 'ADD_SCENE'; template?: Partial<Scene> }
  | { type: 'REMOVE_SCENE'; sceneId: string }
  | { type: 'UPDATE_SCENE'; sceneId: string; patch: Partial<Scene> }
  | { type: 'ADD_CLIP'; sceneId: string; clip: Clip }
  | { type: 'UPDATE_CLIP'; sceneId: string; clipId: string; patch: Partial<Clip> }
  | { type: 'REMOVE_CLIP'; sceneId: string; clipId: string }
  | { type: 'SELECT_CLIP'; clipId: string | null }
  | { type: 'SET_CURRENT_TIME'; time: number }
  | { type: 'SET_IS_PLAYING'; value: boolean }
  | { type: 'SET_LOOP'; value: boolean }
  | { type: 'BUMP_CLIP_Z'; sceneId: string; clipId: string; delta: number }

export const createDefaultTransform = (): TransformSnapshot => ({
  x: 50,
  y: 50,
  scale: 1,
  rotation: 0,
  opacity: 1,
})

export const createBaseScene = (overrides: Partial<Scene> = {}): Scene => ({
  id: createId('scene'),
  name: 'New Scene',
  duration: 12,
  background: '#0f172a',
  gridEnabled: true,
  clips: [],
  ...overrides,
})

export const createInitialState = (): StudioState => {
  const scene = createBaseScene({ name: 'Scene 1' })
  return {
    scenes: [scene],
    selectedSceneId: scene.id,
    selectedClipId: null,
    isPlaying: false,
    currentTime: 0,
    looping: true,
  }
}

const clampTime = (time: number, min: number, max: number) =>
  Math.min(Math.max(time, min), max)

const mutateClip = (clip: Clip, patch: Partial<Clip>): Clip => ({
  ...clip,
  ...patch,
} as Clip)

export const studioReducer = (state: StudioState, action: StudioAction): StudioState => {
  switch (action.type) {
    case 'SELECT_SCENE': {
      const scene = state.scenes.find((s) => s.id === action.sceneId)
      if (!scene) {
        return state
      }
      return {
        ...state,
        selectedSceneId: scene.id,
        selectedClipId: null,
        currentTime: 0,
        isPlaying: false,
      }
    }
    case 'ADD_SCENE': {
      const newScene = createBaseScene(action.template)
      return {
        ...state,
        scenes: [...state.scenes, newScene],
        selectedSceneId: newScene.id,
        selectedClipId: null,
        currentTime: 0,
        isPlaying: false,
      }
    }
    case 'REMOVE_SCENE': {
      if (state.scenes.length <= 1) {
        return state
      }
      const scenes = state.scenes.filter((scene) => scene.id !== action.sceneId)
      const selectedSceneId =
        state.selectedSceneId === action.sceneId ? scenes[0]?.id ?? '' : state.selectedSceneId
      return {
        ...state,
        scenes,
        selectedSceneId,
        selectedClipId:
          selectedSceneId === state.selectedSceneId ? state.selectedClipId : null,
        currentTime: 0,
        isPlaying: false,
      }
    }
    case 'UPDATE_SCENE': {
      const scenes = state.scenes.map((scene) =>
        scene.id === action.sceneId ? { ...scene, ...action.patch } : scene,
      )
      let currentTime = state.currentTime
      if (state.selectedSceneId === action.sceneId) {
        const updatedScene = scenes.find((scene) => scene.id === action.sceneId)
        if (updatedScene && currentTime > updatedScene.duration) {
          currentTime = updatedScene.duration
        }
      }
      return {
        ...state,
        scenes,
        currentTime,
      }
    }
    case 'ADD_CLIP': {
      return {
        ...state,
        scenes: state.scenes.map((scene) =>
          scene.id === action.sceneId
            ? { ...scene, clips: [...scene.clips, action.clip] }
            : scene,
        ),
        selectedClipId: action.clip.id,
      }
    }
    case 'UPDATE_CLIP': {
      return {
        ...state,
        scenes: state.scenes.map((scene) =>
          scene.id === action.sceneId
            ? {
                ...scene,
                clips: scene.clips.map((clip) =>
                  clip.id === action.clipId ? mutateClip(clip, action.patch) : clip,
                ),
              }
            : scene,
        ),
      }
    }
    case 'REMOVE_CLIP': {
      return {
        ...state,
        scenes: state.scenes.map((scene) =>
          scene.id === action.sceneId
            ? { ...scene, clips: scene.clips.filter((clip) => clip.id !== action.clipId) }
            : scene,
        ),
        selectedClipId:
          state.selectedClipId === action.clipId ? null : state.selectedClipId,
      }
    }
    case 'SELECT_CLIP': {
      return {
        ...state,
        selectedClipId: action.clipId,
      }
    }
    case 'SET_CURRENT_TIME': {
      const scene = state.scenes.find((s) => s.id === state.selectedSceneId)
      if (!scene) {
        return state
      }
      const time = clampTime(action.time, 0, scene.duration)
      return {
        ...state,
        currentTime: time,
      }
    }
    case 'SET_IS_PLAYING': {
      return {
        ...state,
        isPlaying: action.value,
      }
    }
    case 'SET_LOOP': {
      return {
        ...state,
        looping: action.value,
      }
    }
    case 'BUMP_CLIP_Z': {
      return {
        ...state,
        scenes: state.scenes.map((scene) => {
          if (scene.id !== action.sceneId) {
            return scene
          }
          return {
            ...scene,
            clips: scene.clips.map((clip) =>
              clip.id === action.clipId
                ? { ...clip, zIndex: clip.zIndex + action.delta }
                : clip,
            ),
          }
        }),
      }
    }
    default:
      return state
  }
}

export const reorderZIndices = (clips: Clip[]): Clip[] => {
  return clips
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((clip, index) => ({
      ...clip,
      zIndex: index * 10,
    }))
}

export const duplicateVoiceClip = (clip: VoiceClip): VoiceClip => ({
  ...clip,
  id: createId('clip-voice'),
  name: `${clip.name} Copy`,
})
