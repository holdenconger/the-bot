# Aurora Movie Studio (React + Vite)

Aurora is a web-based movie creation studio that runs entirely in the browser. Combine animated titles, shapes, images, videos, and AI-generated voiceovers to stitch together cinematic stories scene-by-scene.

## Getting Started

```bash
npm install
npm run dev
```

Open the app at [http://localhost:5173](http://localhost:5173) and begin crafting scenes.  
Build an optimized bundle with `npm run build`.

## Core Features

- **Scene & layer management** – add, duplicate, or remove scenes while maintaining their clips
- **Interactive stage** – drag-select layers and preview CSS-driven animation interpolated between start/end transforms
- **Timeline with playhead** – scrub, loop, or autoplay the timeline to preview composite animation timing
- **Clip inspector** – fine-tune timing, motion, typography, shape geometry, media sizing, and z-ordering
- **Asset ingestion** – upload images (data URLs) and videos (object URLs cleaned up when deleted)
- **AI voiceovers** – leverage the Speech Synthesis API for script narration with configurable voice, rate, pitch, and volume

## Workflow Tips

- Use the **Creative Toolbox** on the left to add text, shapes, voiceovers, and media assets to the active scene.
- The **Inspector** reacts to the selected clip; edits are reflected immediately in the stage and timeline.
- Toggle the motion grid from the Scene Settings panel to visualise alignment.
- Loop playback to iterate on motion quickly, or press Stop to reset to 0s and clear queued voiceovers.
- Videos imported from disk are loaded via `URL.createObjectURL` and automatically revoked when a clip or scene is removed.

## Browser Notes

AI voice playback relies on the browser `speechSynthesis` API. Modern Chromium-based browsers provide the widest voice selection; Safari offers more limited voices. If speech synthesis is unavailable, the voice inspector displays a warning and gracefully skips playback.

## Project Structure

- `src/components` – layout primitives (stage, timeline, inspector, etc.)
- `src/hooks` – state management (`useStudioState`) and speech voice loader
- `src/state` – reducer, initial state, and utilities for clip duplication
- `src/types.ts` – domain models for scenes, clips, transforms, and voice settings

Have fun experimenting with motion storytelling directly in the browser!
