# AI Voice Tutor for Documents — Back-end

A clean-architecture TypeScript back-end that serves the four HTTP APIs the
React front-end consumes: `/api/documents`, `/api/chat`, `/api/speak`, and
`/api/transcribe`.

It is a **faithful clone** of the original Next.js project's backend behavior —
the agentic RAG tutor, embeddings, semantic retrieval, model-driven citations,
and keyless demo mode are all reproduced — re-platformed onto **Express**,
**TypeORM + PostgreSQL**, and **S3** object storage. **OpenAI** powers the
tutor, embeddings, text-to-speech, and transcription.

## Architecture

Dependencies point strictly inward — outer layers depend on inner layers, never
the reverse.

```
src/
  domain/            Enterprise core. Pure TypeScript, zero framework imports.
    entities/        DocumentRecord, DocumentPage, DocumentChunk, Reference.
    repositories/    DocumentRepository — the persistence boundary (interface).
    services/        Port interfaces (FileStorage, TutorService, EmbeddingService,
                     speech I/O, DocumentTextExtractor) plus pure logic:
                     retrieval ranking and document chunking.
    errors/          Framework-agnostic AppError hierarchy.

  application/       Use cases — one class per business operation.
    use-cases/       documents · chat · speech · transcription
    dto/             Wire-format contracts shared with the front-end.

  infrastructure/    Adapters that implement the domain ports.
    config/          Zod-validated environment.
    persistence/     TypeORM entities, data source, migrations, repository impl.
    storage/         S3FileStorage (AWS S3).
    ai/              OpenAI agentic tutor, embeddings, speech; prompt copy.
    documents/       pdf.js / text extractor.
    http/            Express server, controllers, routes, middleware.

  container.ts       Composition root — wires the entire dependency graph.
  main.ts            Process entry point and lifecycle.
```

**The dependency rule in practice:** a use case depends only on domain
interfaces. The concrete S3, Postgres, and OpenAI adapters are injected in
`container.ts` — the single file that imports concrete classes.

## How the tutor works (faithful to the original)

The tutor reads the document **agentically**. It is not handed the document up
front; instead it calls three tools, and `OpenAiTutorService` runs each one and
feeds the result back, looping until the model produces spoken text:

- `get_outline()` — every page with a one-line preview.
- `get_page(n)` — the full text of one page (positional questions).
- `search_document(query)` — semantic + keyword ranking over chunks.

**Retrieval** blends an embedding cosine score with a keyword score
(`domain/services/retrieval.ts`). On upload, pages are split into overlapping
chunks; embeddings are computed **in a background job** so the upload returns
immediately — until they land, `search_document` falls back to keyword ranking.

**Citations** are model-driven: once the answer is composed, the cited page is
matched to the `page N` the answer actually mentions, and emitted as an SSE
`meta` event so the document panel follows along.

**Keyless demo mode:** with no `OPENAI_API_KEY`, the tutor streams a local
fallback answer instead of failing — the app stays usable offline.

## Quick start

```bash
# 1. Dependencies — PostgreSQL in Docker
docker compose up -d

# 2. Configure
cp .env.example .env
#   - set OPENAI_API_KEY   (optional — enables the live tutor, embeddings,
#                           and voice; blank runs demo mode)
#   - set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
#                          (AWS S3 — required for document uploads)

# 3. Install and run
npm install
npm run dev            # http://localhost:5000
```

With `DB_SYNCHRONIZE=true` (the default in development) the schema is created
automatically. For production, set it to `false` and run migrations:

```bash
npm run build
npm run migration:run
npm start
```

## API surface

| Method & path             | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `POST /api/documents`     | Upload a lesson file (`multipart` field `file`)      |
| `GET  /api/documents/:id` | Load a processed document (record, pages, fileUrl)   |
| `GET  /api/documents/:id/file` | Stream the original file (authenticated proxy)  |
| `POST /api/chat`          | Stream an agentic tutor answer as Server-Sent Events |
| `POST /api/speak`         | Synthesize one sentence → audio                      |
| `POST /api/transcribe`    | Transcribe a recorded clip (`multipart` `audio`)     |
| `GET  /health`            | Liveness probe                                       |

## Re-platforming notes (vs. the original)

The **behavior** is cloned; the **platform** is the requested stack:

- **Storage:** the original used a local JSON store or Supabase. Here documents,
  pages, and chunks live in **PostgreSQL via TypeORM**; original files live in
  **S3**. Chunk embeddings are stored as JSONB — ranking runs in application
  memory, so no `pgvector` extension is required.
- **File access:** `fileUrl` points at the authenticated `/api/documents/:id/file`
  proxy, which streams the object from S3 — the file stays private.
- Everything else — the agentic tool loop, embeddings, retrieval ranking,
  citation matching, demo mode, history truncation, validation, status codes —
  mirrors the original.

## Environment

See [`.env.example`](.env.example) for every variable. The environment is
validated by Zod at startup; an invalid configuration fails fast with a clear
message.
