# Web Movie Creation Studio

This repository hosts a browser-based movie studio that lets you script, stage, and animate stories directly in the web UI.  
The React + TypeScript frontend lives in `movie-studio/` and is powered by Vite.

## Quick Start

```bash
cd movie-studio
npm install
npm run dev
```

The development server runs at `http://localhost:5173`. A production bundle can be created with `npm run build`.

## Highlights

- Multi-scene timeline with play/pause, scrubbing, and looping controls
- Layer-based stage renderer for animated text, shapes, images, and videos
- AI voiceovers using the browser Speech Synthesis API with voice, rate, and pitch controls
- Clip inspector for fine-grained motion, timing, and styling adjustments
- Asset import pipeline for custom images and videos (object URLs automatically cleaned up when removed)

Refer to `movie-studio/README.md` for feature walkthroughs and tips.