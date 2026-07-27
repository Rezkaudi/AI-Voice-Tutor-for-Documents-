# AI Voice Tutor for Documents

> **In one sentence:** Upload a PDF (or a text/markdown file), and an AI tutor reads it for you — answering your questions by voice or text, but **only** using what is written inside that file.

Think of it like hiring a private teacher who is given a single book to study. The teacher will only answer from that book. If something isn't in the book, the teacher will say so — they won't make things up from the internet.

---

## Table of Contents

- [What Can It Do?](#what-can-it-do)
- [Who Is This For?](#who-is-this-for)
- [How It Works (The Simple Picture)](#how-it-works-the-simple-picture)
- [Workflows — Step by Step](#workflows--step-by-step)
  - [Workflow 1: Uploading a Document](#workflow-1-uploading-a-document)
  - [Workflow 2: Asking a Question (Text)](#workflow-2-asking-a-question-text)
  - [Workflow 3: Asking a Question (Voice)](#workflow-3-asking-a-question-voice)
  - [Workflow 4: Hearing the Tutor Speak](#workflow-4-hearing-the-tutor-speak)
  - [Workflow 5: Quiz / Lesson Modes](#workflow-5-quiz--lesson-modes)
- [The Two Apps Inside This Project](#the-two-apps-inside-this-project)
- [The Tech (In Plain Words)](#the-tech-in-plain-words)
- [Project Structure](#project-structure)
- [Setup — From Zero to Running](#setup--from-zero-to-running)
- [Running the App](#running-the-app)
- [How the AI Tutor Thinks (For the Curious)](#how-the-ai-tutor-thinks-for-the-curious)
- [How the App Finds the Right Answer (RAG, Explained Simply)](#how-the-app-finds-the-right-answer-rag-explained-simply)
- [API Reference](#api-reference)
- [Database Tables](#database-tables)
- [Deployment](#deployment)
- [Common Questions](#common-questions)

---

## What Can It Do?

- 📄 **Read any PDF, `.txt`, or `.md` file** you give it (up to 30 MB).
- 💬 **Chat with you in writing** about what's inside.
- 🎙️ **Listen to you talk** (record with your microphone) and turn your voice into a question.
- 🔊 **Talk back to you out loud** using a natural AI voice.
- 📍 **Show you exactly where** the answer came from in the document (page number + a quote).
- 📚 **Remember your documents** so you can come back to them later.
- 🎓 **Switch modes** — normal chat, quiz me, or run a guided lesson.
- 🧪 **Work without an API key** in "demo mode" so you can try it offline.

---

## Who Is This For?

- 🧑‍🎓 **Students** revising notes, textbooks, or research papers.
- 👩‍🏫 **Teachers** preparing material from PDFs.
- 🧑‍💻 **Developers** learning Clean Architecture + RAG (retrieval-augmented generation) by example.
- 🧐 **Anyone** who has a long PDF and wants to "talk" to it instead of scrolling through it.

---

## How It Works (The Simple Picture)

```mermaid
flowchart LR
    A[👤 You] -- "upload PDF" --> B[🌐 Web App]
    A -- "ask question (text/voice)" --> B
    B -- "saves & processes" --> C[🧠 Back End Server]
    C -- "stores file" --> D[(☁️ Cloud Storage)]
    C -- "stores text + index" --> E[(🗄️ Database)]
    C -- "asks AI" --> F[🤖 OpenAI]
    F -- "answer" --> C
    C -- "streams answer" --> B
    B -- "shows text + speaks aloud" --> A
```

Three main pieces:

| Piece | What it is | What it does |
|---|---|---|
| **Front end** | The website you see in the browser | Lets you upload files, talk, listen, and chat |
| **Back end** | A server running on your computer | Reads the PDF, talks to OpenAI, sends answers back |
| **OpenAI** | An external AI service | Understands questions, writes answers, transcribes voice, generates speech |

---

## Workflows — Step by Step

### Workflow 1: Uploading a Document

```mermaid
sequenceDiagram
    participant You
    participant App as 🌐 Web App
    participant Server as 🧠 Server
    participant S3 as ☁️ Storage
    participant DB as 🗄️ Database
    participant AI as 🤖 OpenAI

    You->>App: Drag & drop a PDF
    App->>Server: Send the file
    Server->>Server: Check file type & size (≤30 MB)
    Server->>S3: Save the original file
    Server->>Server: Extract the text from each page
    Server->>Server: Split text into small chunks (~1600 chars)
    Server->>DB: Save the document + pages + chunks
    Server-->>App: ✅ "Document ready!"
    Note over Server,AI: In the background...
    Server->>AI: "Convert each chunk into numbers" (embeddings)
    AI-->>Server: Vectors
    Server->>DB: Save the vectors
```

**Plain English:** You drop a PDF. The server saves it, pulls all the words out, cuts them into bite-sized pieces, and asks the AI to make a "fingerprint" of each piece so it can find them later. Done — ready to chat.

---

### Workflow 2: Asking a Question (Text)

```mermaid
sequenceDiagram
    participant You
    participant App as 🌐 Web App
    participant Server as 🧠 Server
    participant AI as 🤖 OpenAI

    You->>App: Type "What does page 3 say about apples?"
    App->>Server: Send question + document ID
    Server->>Server: Load all pages & chunks into memory
    Server->>AI: "You are a tutor for THIS document. Question: ..."
    AI->>Server: "I need to search the doc"
    Server-->>AI: Top matching chunks
    AI-->>Server: Answer (word by word, streaming)
    Server-->>App: Stream words live (SSE)
    App-->>You: See answer appear letter by letter
    App-->>You: 📍 Auto-scroll PDF to the cited page
```

**Plain English:** Your question goes to the AI along with the document. The AI is allowed to use three "tools" — read the outline, read a specific page, or search for keywords. It decides which one to use, finds the answer, and writes it back to you word by word.

---

### Workflow 3: Asking a Question (Voice)

```mermaid
sequenceDiagram
    participant You
    participant Mic as 🎙️ Browser Mic
    participant App as 🌐 Web App
    participant Server as 🧠 Server
    participant Whisper as 🤖 Whisper (OpenAI)

    You->>Mic: Click record, speak
    Mic->>App: Audio blob
    App->>Server: POST /api/transcribe
    Server->>Whisper: Transcribe this audio
    Whisper-->>Server: "What does page 3 say about apples?"
    Server-->>App: The text
    App->>App: Auto-send as a chat message
    Note over App,Server: → continues like Workflow 2
```

**Plain English:** You hold the record button and talk. The recording is sent to OpenAI's Whisper service, which turns it into text. From there it's just like typing.

---

### Workflow 4: Hearing the Tutor Speak

```mermaid
sequenceDiagram
    participant App as 🌐 Web App
    participant Server as 🧠 Server
    participant TTS as 🔊 OpenAI TTS

    Server->>Server: Cut the reply into sentences as it streams
    Server->>TTS: Make this sentence sound like speech
    TTS-->>Server: Audio bytes
    Server-->>App: `speech-*` SSE events on the same chat stream
    App-->>App: 🔊 Play each clip in order
```

**Plain English:** While the answer is still being written, the server slices it sentence by sentence, has OpenAI read each one aloud, and pushes the audio down the same stream as the text — so the browser can start playing before the answer is finished. There is no separate "speak" request.

---

### Workflow 5: Quiz / Lesson Modes

The tutor isn't just for Q&A. Three quick-action chips switch its personality:

| Mode | What happens |
|---|---|
| 💬 **Chat** | Normal Q&A — you ask, it answers |
| 🧪 **Quiz** | The tutor asks YOU questions about the document and checks your answers |
| 🎓 **Lesson** | The tutor walks you through the document section by section, like a teacher |

All three use the same underlying engine — only the instructions to the AI change.

---

## The Two Apps Inside This Project

```
AI Voice Tutor for Documents/
│
├── front-end/    ← The website (what you see in the browser)
│
└── back-end/     ← The server (the brain doing the work)
```

You run them **both at the same time**. The website talks to the server over HTTP.

---

## The Tech (In Plain Words)

| Layer | Tool | Why it's here |
|---|---|---|
| **Website UI** | React 19 + Vite | Modern, fast web framework |
| **Styling** | Tailwind CSS 4 | Pretty designs without writing CSS files |
| **State (memory in browser)** | Zustand | Keeps track of your chat, document, voice settings |
| **Server** | Node.js + Express | Handles HTTP requests |
| **Language** | TypeScript everywhere | Catches bugs before you run the code |
| **Database** | PostgreSQL + TypeORM | Stores documents and chunks |
| **File storage** | S3-compatible (AWS / R2 / MinIO) | Stores the actual PDF files |
| **AI brain** | OpenAI (chat + embeddings) | Understands and answers questions |
| **Speech-to-text** | OpenAI Whisper | Turns your voice into text |
| **Text-to-speech** | OpenAI TTS | Turns answers into voice |
| **PDF parsing** | `pdfjs-dist` | Pulls text out of PDFs |
| **Live streaming** | Server-Sent Events (SSE) | Sends the answer word-by-word as it's written |

---

## Project Structure

```text
.
├── back-end/                              The server (Clean Architecture)
│   └── src/
│       ├── domain/         ← Pure business rules (no frameworks)
│       │   ├── entities/                  Document, Chat — "what is a document?"
│       │   ├── repositories/              "What can we do with documents?" (interfaces)
│       │   ├── services/                  "What can AI do?" (interfaces)
│       │   └── errors/                    Custom error types
│       │
│       ├── application/    ← The "use cases" — one file per feature
│       │   ├── use-cases/                 chat, documents, speech, transcription
│       │   ├── services/                  Helpers like chunking and retrieval
│       │   └── dto/                       Request/response shapes
│       │
│       ├── infrastructure/ ← The actual tech (Express, OpenAI, S3, Postgres)
│       │   ├── http/                      The web server itself
│       │   ├── database/                  TypeORM setup & migrations
│       │   └── services/                  Real implementations (OpenAI, S3 adapters)
│       │
│       ├── config/                        Reads .env file
│       ├── container.ts                   Wires everything together
│       └── main.ts                        Starts the server
│
├── front-end/                             The website
│   └── src/
│       ├── components/    ← The visual building blocks
│       ├── services/      ← Talks to the back end (chatApi, documentsApi, …)
│       ├── store/         ← In-browser memory (Zustand)
│       └── App.tsx        ← The root of the website
│
├── package.json           ← One command runs both apps
└── README.md              ← You are here 👋
```

> **Clean Architecture in 10 seconds:** the inner layers (domain, application) don't know the outer layers exist. That means you could swap PostgreSQL for MongoDB, or OpenAI for another provider, without changing your business logic. The cost is more folders. The benefit is you can test everything without spinning up a database.

---

## Setup — From Zero to Running

### 1. What You Need First

- **Node.js** version 20.19 or newer
- **PostgreSQL** running somewhere (locally or in the cloud)
- An **S3 bucket** (AWS S3, Cloudflare R2, or MinIO all work)
- An **OpenAI API key** — *optional* (without it, the app runs in demo mode)

### 2. Install Both Apps

```bash
npm --prefix front-end install
npm --prefix back-end install
```

### 3. Create Your `.env` Files

```bash
cp front-end/.env.example front-end/.env
cp back-end/.env.example back-end/.env
```

Open `back-end/.env` and fill it in:

```text
DATABASE_URL=postgres://tutor:tutor@localhost:5432/ai_voice_tutor
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
OPENAI_API_KEY=your-openai-key            # optional — demo mode works without it
DB_SYNCHRONIZE=true                       # OK for development; use migrations in prod
```

---

## Running the App

From the project root, one command starts everything:

```bash
npm run dev
```

Or run them separately in two terminals:

```bash
npm --prefix back-end run dev          # Terminal 1
npm --prefix front-end run dev         # Terminal 2
```

Then open:

- 🌐 Website: **http://localhost:5173**
- 🧠 API:    **http://localhost:5000**

### Useful Scripts

```bash
# Front end
npm --prefix front-end run build
npm --prefix front-end run lint
npm --prefix front-end run typecheck

# Back end
npm --prefix back-end run build
npm --prefix back-end run typecheck
npm --prefix back-end run migration:generate
npm --prefix back-end run migration:run
npm --prefix back-end run migration:revert
```

---

## How the AI Tutor Thinks (For the Curious)

The tutor is **not** a single prompt. It's a small **agent loop** — meaning the AI can take multiple steps and use "tools" to read the document. Here's what happens behind the scenes when you ask a question:

```mermaid
flowchart TD
    Start([Question arrives]) --> Validate{Document exists?}
    Validate -- No --> Error1[Return 404]
    Validate -- Yes --> Load[Load all pages + chunks into memory]
    Load --> Trim[Trim chat history to last 10 turns]
    Trim --> Open[Open SSE stream to browser]
    Open --> Loop{Ask OpenAI}
    Loop -- "Wants to use a tool" --> Tool[Run tool locally:<br/>get_outline<br/>get_page<br/>search_document]
    Tool --> Loop
    Loop -- "Final answer" --> Stream[Stream words to browser]
    Stream --> Cite[Find cited page number]
    Cite --> Done([Send 'done' event])
```

**Key tricks:**

1. **AbortController** — if you close the browser tab, the abort signal travels all the way to OpenAI so you don't keep paying for tokens you won't read.
2. **History trimming** — only the last 10 turns are sent, each capped at 4000 chars, so the prompt size is predictable.
3. **Per-output buffering** — the model can emit several message items in one response (interim restatement + final). The code groups tokens by `output_index` to avoid duplicating text.
4. **Citation picking** — after the answer is done, the code scans for `"page N"` mentions and emits that as a `meta` event so the PDF viewer can scroll to the right page.
5. **Demo mode** — no API key? The tutor returns a canned answer using the first chunk of the document. The app stays usable.
6. **Save cost mode** — a toggle that switches to a cheaper model with shorter history and lower reasoning effort.

---

## How the App Finds the Right Answer (RAG, Explained Simply)

**RAG** = **R**etrieval-**A**ugmented **G**eneration. In normal English: *"Look up the relevant bits of the document first, THEN ask the AI."*

### The 3-Step RAG Recipe

```mermaid
flowchart LR
    Q[Your question] --> E[Turn it into a vector<br/>'fingerprint']
    E --> M[Compare with every chunk's<br/>fingerprint in the DB]
    M --> T[Take top 6 most similar chunks]
    T --> P[Send chunks + question to OpenAI]
    P --> A[Answer]
```

### How Chunks Are Made

1. **Extract** all text from the PDF (one page at a time).
2. **Split** each page into ~1600-character chunks with ~220 characters of overlap. Overlap prevents losing context at the cut point.
3. **Save** each chunk with its page number so we can cite it later.

### How Search Works (Hybrid Scoring)

For every chunk we compute:

- **Keyword score** — how many times your question's words appear in the chunk
- **Vector score** — how "semantically similar" the chunk is to your question (using embeddings)

Then: `final_score = keyword_score + vector_score × 2`

This is **hybrid retrieval**. If the embeddings haven't been computed yet (they're done in the background), search falls back gracefully to keywords only.

### Why "Agentic" Instead of Classic RAG?

Most apps do this once: grab top-k chunks, jam them into the prompt, get an answer. This app is smarter — the AI gets **three tools** and decides:

- 📋 **`get_outline`** — "Show me the table of contents."
- 📄 **`get_page(N)`** — "Give me page 5 in full."
- 🔍 **`search_document(q)`** — "Find chunks about X."

So for short docs it reads pages directly; for long docs it searches. Same engine, different strategy per document.

> **Why JSONB instead of pgvector?** Embeddings are stored as JSON in Postgres and ranked in Node memory. This avoids requiring the `pgvector` extension, so you can deploy on any Postgres host. The trade-off: it won't scale past tens of thousands of chunks per document. Fine for an MVP.

---

## API Reference

All endpoints live under `/api` (except `/health`).

| Method   | Path                       | What it does                              |
| -------- | -------------------------- | ----------------------------------------- |
| `GET`    | `/health`                  | Is the server alive? Returns `{status:"ok"}` |
| `GET`    | `/api/documents`           | List your documents                       |
| `POST`   | `/api/documents`           | Upload a new document (multipart)         |
| `GET`    | `/api/documents/:id`       | Get a document + its pages and chunks     |
| `DELETE` | `/api/documents/:id`       | Delete a document and its file            |
| `GET`    | `/api/documents/:id/file`  | Download the original PDF                 |
| `POST`   | `/api/chat`                | Ask a question — streams the answer (SSE) |
| `POST`   | `/api/transcribe`          | Turn audio into text                      |

### Example: `POST /api/chat`

**Request body:**

```json
{
  "documentId": "uuid-of-your-document",
  "message": "What does the author say about apples?",
  "language": "en",
  "messages": [
    { "role": "user", "content": "Earlier question..." },
    { "role": "assistant", "content": "Earlier answer..." }
  ],
  "saveCost": false
}
```

**Response:** `text/event-stream`. You'll receive a stream of events:

| Event | Payload | Meaning |
|---|---|---|
| `meta` | `{ reference: null }` | Start of stream — clear any old citation |
| `delta` | `{ text: "..." }` | A piece of the answer (token) |
| `meta` | `{ reference: { pageNumber } }` | Cited page found — UI should scroll |
| `done` | `{}` | Answer complete |
| `error` | `{ error: "..." }` | Something failed mid-stream |

---

## Database Tables

```mermaid
erDiagram
    DOCUMENTS ||--o{ DOCUMENT_PAGES : "has"
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : "has"

    DOCUMENTS {
        uuid id PK
        text title
        text file_name
        varchar mime_type
        varchar file_type "pdf | text | markdown"
        bigint file_size
        varchar status "ready | failed"
        int page_count
        text storage_path "S3 key"
        timestamptz created_at
        timestamptz updated_at
        text error
    }

    DOCUMENT_PAGES {
        uuid id PK
        uuid document_id FK
        int page_number
        text text
    }

    DOCUMENT_CHUNKS {
        uuid id PK
        uuid document_id FK
        int page_number
        int chunk_index
        text text
        jsonb embedding "vector or null"
    }
```

- Delete a document → its pages and chunks delete automatically (`ON DELETE CASCADE`).
- `storage_path` is the S3 object key, never a URL — the server streams the file so your credentials don't leak.
- `embedding: null` is a valid state — it means the background job hasn't run yet. Search still works via keywords.

---

## Deployment

The back end ships with a `Dockerfile`:

```bash
docker build -t ai-voice-tutor-backend ./back-end
docker run --env-file ./back-end/.env -p 5000:5000 ai-voice-tutor-backend
```

For production:

- Use **TypeORM migrations** (`npm run migration:run`) instead of `DB_SYNCHRONIZE=true` — otherwise schema changes happen automatically and can erase data.
- Set `OPENAI_API_KEY` as a real secret (don't commit it).
- Put a reverse proxy (nginx/Caddy) in front of the Node server.

---

## Common Questions

**Q: Will the tutor answer from the internet?**
No. By design it only uses the document you uploaded. If the answer isn't in the file, it will say so.

**Q: Do I really need an OpenAI API key?**
No — there's a demo mode that returns canned answers. But for real Q&A, voice in (Whisper), and voice out (TTS), you need a key.

**Q: How big can my PDF be?**
30 MB max. Larger files are rejected.

**Q: Can I use a different AI provider?**
Yes, but you'd write a new adapter. The `domain` layer doesn't know about OpenAI — only `infrastructure/services/ai/` does. Swap that out and you're good.

**Q: Where does the recorded audio go?**
Straight to OpenAI's Whisper API for transcription. It isn't stored on the server.

**Q: Can I run this 100% offline?**
The app starts and runs in demo mode without OpenAI. But you'll lose: real AI answers, voice input, and voice output.

**Q: Why do uploads finish quickly but search feels weak at first?**
Embeddings are computed in the background after upload. Until they're ready, search runs on keywords only. Refresh in ~30 seconds for full hybrid search.

---

*Made with Clean Architecture, a love for documents, and a strong belief that AI should cite its sources.*
