import type { ChangeEvent } from 'react'
import type { Scene } from '../types'

export interface SceneSidebarProps {
  scenes: Scene[]
  selectedSceneId: string
  onSelectScene: (sceneId: string) => void
  onAddScene: () => void
  onDuplicateScene: (sceneId: string) => void
  onRemoveScene: (sceneId: string) => void
  onUpdateScene: (sceneId: string, patch: Partial<Scene>) => void
}

export const SceneSidebar = ({
  scenes,
  selectedSceneId,
  onSelectScene,
  onAddScene,
  onDuplicateScene,
  onRemoveScene,
  onUpdateScene,
}: SceneSidebarProps) => {
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId)

  const handleNameChange = (sceneId: string) => (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateScene(sceneId, { name: event.target.value })
  }

  const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedScene) return
    const value = Number(event.target.value)
    onUpdateScene(selectedScene.id, {
      duration: Number.isFinite(value) ? Math.max(1, value) : selectedScene.duration,
    })
  }

  return (
    <aside className="scene-sidebar">
      <header>
        <h2>Scenes</h2>
        <button onClick={onAddScene}>
          + New Scene
        </button>
      </header>
      <div className="scene-list">
        {scenes.map((scene) => {
          const active = scene.id === selectedSceneId
          return (
            <div
              key={scene.id}
              className={`scene-item ${active ? 'active' : ''}`}
            >
              <button className="scene-pill" onClick={() => onSelectScene(scene.id)}>
                <span className="scene-name">{scene.name}</span>
                <span className="scene-duration">{scene.duration}s</span>
              </button>
              <input
                className="scene-input"
                value={scene.name}
                onChange={handleNameChange(scene.id)}
              />
              <div className="scene-actions">
                <button onClick={() => onDuplicateScene(scene.id)}>Duplicate</button>
                <button
                  onClick={() => onRemoveScene(scene.id)}
                  disabled={scenes.length <= 1}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {selectedScene && (
        <div className="scene-settings">
          <h3>Scene Settings</h3>
          <label>
            Duration (seconds)
            <input
              type="number"
              min={1}
              value={selectedScene.duration}
              onChange={handleDurationChange}
            />
          </label>
          <label>
            Background
            <input
              type="color"
              value={selectedScene.background}
              onChange={(event) =>
                onUpdateScene(selectedScene.id, { background: event.target.value })
              }
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={selectedScene.gridEnabled}
              onChange={(event) =>
                onUpdateScene(selectedScene.id, { gridEnabled: event.target.checked })
              }
            />
            Show motion grid
          </label>
        </div>
      )}
    </aside>
  )
}
