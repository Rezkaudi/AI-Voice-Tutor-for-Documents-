# AI Voice Tutor for Documents — Front-end (React)

A React + Vite re-implementation of the front-end of the original Next.js
project **"AI Voice Tutor for Documents"**. The design and functionality are an
exact clone — state is managed with **Zustand**.

This app is **front-end only**. It consumes the original project's HTTP APIs
(`/api/documents`, `/api/chat`, `/api/speak`, `/api/transcribe`).

## Running

The backend (the original Next.js project) must be running first:

```bash
# in the original "AI Voice Tutor for Documents" project
npm run dev          # serves the APIs on http://localhost:5000
```

Then start this front-end:

```bash
nvm use              # Node 22 — Vite 8 needs Node >= 20.19
npm install
npm run dev          # http://localhost:5173
```

The browser calls the backend directly. Set `VITE_API_BASE_URL` in `.env`
(see `.env.example`) — defaults to `http://localhost:5000`. The backend
must allow this frontend's origin via its `CORS_ORIGINS` setting.

## Project structure

A conventional, feature-grouped React structure — files grouped by what they
are (components, store, services, lib):

```
src/
  main.jsx              App entry point.
  App.jsx               Root component.
  index.css             Global styles (cloned from the original project).

  components/            UI — React components (PascalCase).
    TeachingApp.jsx      The container: reads the store, renders the workspace.
    UploadPanel.jsx      Drag-and-drop document upload.
    DocumentBoard.jsx    Document / PDF viewer with page navigation.
    TeacherPanel.jsx     Voice-call panel: avatar, captions, controls.
    TeacherAvatar.jsx    Animated illustrated teacher.
    Splitter.jsx         Draggable pane divider.
    ConfirmDialog.jsx    Confirm-restart modal.
    MicPermissionDialog.jsx  Blocked-microphone help modal.

  store/                 Zustand stores — all app state and actions.
    sessionStore.js      Orchestrator: call mode, language, cross-store flows.
    documentStore.js     Upload, pages, teacher highlight.
    chatStore.js         Streaming tutor conversation.
    speechStore.js       Speech state (wraps speechEngine).
    voiceStore.js        Microphone state (wraps voiceRecorder).

  services/              External concerns — HTTP and browser APIs.
    documentsApi.js / chatApi.js
    speechApi.js / transcribeApi.js   Thin fetch wrappers per endpoint.
    speechEngine.js      Ordered TTS playback + live-caption engine.
    voiceRecorder.js     MediaRecorder capture + transcription round-trip.

  lib/                   Pure helpers — no React, no app state.
    constants.js         Shared constants (greeting prompt, languages).
    sentences.js         Sentence splitting for streamed text.
    sse.js               Server-sent-events parsing.
    textSegmentation.js  Word segmentation + RTL detection for captions.
    messageFormat.jsx    Chat / highlight rendering helpers.
```

### How it works

- **Components** render; they hold only local UI state. `TeachingApp` is the
  container — it reads the stores with selector hooks and passes props down.
- **Store** (Zustand) holds all shared state and actions. Cross-store flows
  (e.g. ending a call aborts chat, voice and speech) live in `sessionStore`
  and call other stores via `useStore.getState()` — no prop drilling.
- **Services** talk to the outside world: the backend APIs, plus the
  `speechEngine` and `voiceRecorder` classes that drive the Web Audio /
  MediaRecorder APIs.
- **Lib** is pure, reusable, dependency-free helpers.
