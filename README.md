# AI Teaching Avatar MVP

A simple document-learning web app: upload a searchable PDF, `.txt`, or `.md` file, let the server extract and chunk the text, then learn from it in a split-screen teacher session.

## What Works

- Upload PDF, text, and markdown files up to 25MB.
- Extract PDF text page by page, skipping scanned/OCR-only PDFs for the MVP.
- Chunk document text and embed it when `OPENAI_API_KEY` is configured.
- Ask questions and get a streaming teacher answer.
- Jump the document board to the related page and highlight the referenced passage.
- Use browser `SpeechSynthesis` for teacher voice playback.
- Run without external services in local demo mode using `.data` file storage and keyword retrieval.
- Use Supabase Storage/Postgres when the Supabase environment variables are configured.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

For real AI answers, add `OPENAI_API_KEY` to `.env.local`. Without it, the app still demonstrates upload, retrieval, highlighting, and a deterministic teacher response.

## Supabase Setup

1. Create a Supabase project.
2. Run [supabase/schema.sql](./supabase/schema.sql) in the SQL editor.
3. Create a private storage bucket named `teaching-documents`.
4. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`.

If Supabase variables are missing, the app uses local `.data` storage.

## MVP API

- `POST /api/documents`: upload and process one file.
- `GET /api/documents/:id`: fetch document metadata, extracted pages, and file URL.
- `GET /api/documents/:id/file`: serve the original local file.
- `POST /api/chat`: stream the tutor answer as server-sent events.
- `GET|POST /api/access`: optional access-code gate.

## Limits

- Max file size: 25MB.
- Max PDF length: 300 pages.
- PDF support is text extraction only, not OCR.
- Realtime microphone voice, DOCX, video/lip-sync avatars, quizzes, and multi-user libraries are phase 2.
