import { useRef } from 'react'
import type { ChangeEvent } from 'react'

export interface ClipLibraryProps {
  onAddText: () => void
  onAddShape: () => void
  onAddVoice: () => void
  onAddImage: (src: string, name?: string) => void
  onAddVideo: (src: string, name?: string) => void
}

export const ClipLibrary = ({
  onAddText,
  onAddShape,
  onAddVoice,
  onAddImage,
  onAddVideo,
}: ClipLibraryProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onAddImage(reader.result, file.name.replace(/\.[^/.]+$/, ''))
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleVideoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    onAddVideo(objectUrl, file.name.replace(/\.[^/.]+$/, ''))
    event.target.value = ''
  }

  return (
    <div className="clip-library">
      <h3>Creative Toolbox</h3>
      <div className="clip-buttons">
        <button onClick={onAddText}>Add Title Text</button>
        <button onClick={onAddShape}>Add Motion Shape</button>
        <button onClick={onAddVoice}>Add AI Voice</button>
        <button onClick={() => imageInputRef.current?.click()}>Import Image</button>
        <button onClick={() => videoInputRef.current?.click()}>Import Video</button>
      </div>
      <p className="clip-hint">
        Combine animated titles, shapes, images, videos, and AI voiceovers. Use the inspector to fine-tune motion, timing, and style.
      </p>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleVideoUpload}
      />
    </div>
  )
}
