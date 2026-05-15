"use client";

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  LockKeyhole,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  UploadCloud,
  Volume2,
  VolumeX
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, DocumentPage, DocumentRecord, Reference } from "@/lib/types";

type AccessState = "checking" | "locked" | "granted";
type UploadState = "idle" | "processing";

type LoadedDocument = {
  document: DocumentRecord;
  pages: DocumentPage[];
  fileUrl: string | null;
};

type UiMessage = ChatMessage & {
  id: string;
  reference?: Reference | null;
  hidden?: boolean;
};

type StreamEvent =
  | { event: "meta"; data: { reference: Reference | null } }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: Record<string, never> }
  | { event: "error"; data: { error: string } };

export function TeachingApp() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [accessCode, setAccessCode] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [loadedDocument, setLoadedDocument] = useState<LoadedDocument | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [highlight, setHighlight] = useState<Reference | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasIntroduced, setHasIntroduced] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [callMode, setCallMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakRequestRef = useRef(0);
  const callModeRef = useRef(false);

  useEffect(() => {
    callModeRef.current = callMode;
  }, [callMode]);

  const stopSpeaking = useCallback(() => {
    speakRequestRef.current += 1; // invalidate any in-flight TTS fetch
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      if (audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(audio.src);
      }
      audio.removeAttribute("src");
      audio.load();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    const trimmed = transcript.trim();
    if (!trimmed) return;
    sendMessageRef.current?.(trimmed);
  }, []);

  const sendMessageRef = useRef<(content: string) => void>(() => {});

  const handleVoiceError = useCallback((message: string) => {
    setError(message);
  }, []);

  const {
    isListening,
    isTranscribing,
    isSupported: micSupported,
    start: startListening,
    stop: stopListening
  } = useVoiceRecorder(handleVoiceTranscript, handleVoiceError);

  const clearChat = useCallback(() => {
    setMessages([]);
    setHighlight(null);
    setHasIntroduced(false);
    setError(null);
    setIsStreaming(false);
    if (callModeRef.current) {
      setCallMode(false);
      callModeRef.current = false;
      stopListening();
    }
    stopSpeaking();
  }, [stopListening, stopSpeaking]);

  useEffect(() => {
    fetch("/api/access")
      .then((response) => response.json())
      .then((data) => setAccessState(data.granted ? "granted" : "locked"))
      .catch(() => setAccessState("granted"));
  }, []);

  const currentPage = useMemo(() => {
    if (!loadedDocument) {
      return null;
    }

    return loadedDocument.pages.find((page) => page.pageNumber === activePage) ?? loadedDocument.pages[0] ?? null;
  }, [activePage, loadedDocument]);

  async function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: accessCode })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Access failed.");
      return;
    }

    setAccessState("granted");
  }

  async function uploadFile(file: File | null) {
    if (!file) {
      return;
    }

    setUploadState("processing");
    setError(null);
    setMessages([]);
    setHighlight(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "The file could not be uploaded.");
      }

      await loadDocument(data.documentId);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploadState("idle");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function loadDocument(documentId: string) {
    const response = await fetch(`/api/documents/${documentId}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "The processed document could not be loaded.");
    }

    setLoadedDocument(data);
    setActivePage(data.pages[0]?.pageNumber ?? 1);
  }

  async function sendMessage(content: string, options: { hidden?: boolean } = {}) {
    if (!loadedDocument || isStreaming) {
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    setError(null);
    setIsStreaming(true);

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      hidden: options.hidden
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: UiMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      reference: null
    };
    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);

    let assistantText = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentId: loadedDocument.document.id,
          message: trimmed,
          messages: messages.map(({ role, content }) => ({ role, content }))
        })
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "The teacher could not respond.");
      }

      await readEventStream(response.body, (event) => {
        if (event.event === "meta") {
          const reference = event.data.reference;
          setHighlight(reference);
          if (reference) {
            setActivePage(reference.pageNumber);
          }
          setMessages((current) => updateMessage(current, assistantId, { reference }));
        }

        if (event.event === "delta") {
          assistantText += event.data.text;
          setMessages((current) => updateMessage(current, assistantId, { content: assistantText }));
        }

        if (event.event === "error") {
          throw new Error(event.data.error);
        }
      });

      speak(assistantText);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "The teacher could not respond.");
      setMessages((current) => current.filter((message) => message.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  }

  // Keep ref in sync so the speech-recognition hook can auto-send on final result.
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  async function speak(text: string) {
    const trimmed = text.trim();
    if (!voiceEnabled || !trimmed || typeof window === "undefined") {
      maybeContinueCall();
      return;
    }

    const requestId = ++speakRequestRef.current;

    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed })
      });

      if (requestId !== speakRequestRef.current) {
        return; // a newer request superseded this one
      }

      if (!response.ok) {
        throw new Error("tts-failed");
      }

      const blob = await response.blob();
      if (requestId !== speakRequestRef.current) {
        return;
      }

      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;

      if (audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(audio.src);
      }
      audio.src = URL.createObjectURL(blob);
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        maybeContinueCall();
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        maybeContinueCall();
      };
      await audio.play();
    } catch {
      // Fall back to browser SpeechSynthesis if server TTS fails (e.g. no OPENAI_API_KEY).
      if (requestId !== speakRequestRef.current) return;
      if (!("speechSynthesis" in window)) {
        maybeContinueCall();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.rate = 0.96;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        maybeContinueCall();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        maybeContinueCall();
      };
      window.speechSynthesis.speak(utterance);
    }
  }

  function maybeContinueCall() {
    if (!callModeRef.current) return;
    // Resume listening after a short gap so playback fully releases the audio device.
    setTimeout(() => {
      if (callModeRef.current && !isStreamingRef.current) {
        startListening();
      }
    }, 350);
  }

  const isStreamingRef = useRef(false);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  if (accessState === "checking") {
    return (
      <div className="access-wrap">
        <Loader2 className="spin" size={32} aria-hidden />
      </div>
    );
  }

  if (accessState === "locked") {
    return (
      <div className="access-wrap">
        <form className="access-box surface" onSubmit={submitAccess}>
          <LockKeyhole size={36} aria-hidden />
          <h2>Access Code</h2>
          <p>Enter the demo code for this teaching workspace.</p>
          <div style={{ height: 16 }} />
          <input
            className="access-input"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            placeholder="Code"
            type="password"
          />
          <div style={{ height: 12 }} />
          <button className="button primary" type="submit">
            <CheckCircle2 size={18} aria-hidden />
            Enter
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <BookOpen size={21} aria-hidden />
          </div>
          <div>
            <h1 className="brand-title">AI Teaching Avatar</h1>
            <p className="brand-subtitle">
              {loadedDocument ? loadedDocument.document.title : "Document learning board"}
            </p>
          </div>
        </div>
        <div className="status-strip">
          <span className="pill">
            <FileText size={15} aria-hidden />
            {loadedDocument ? `${loadedDocument.document.pageCount} pages` : "PDF, TXT, MD"}
          </span>
          <span className="pill">
            <Volume2 size={15} aria-hidden />
            Browser voice
          </span>
        </div>
      </header>

      {loadedDocument ? (
        <main className="workspace">
          <section className="document-pane" aria-label="Document board">
            <DocumentBoard
              fileUrl={loadedDocument.fileUrl}
              mimeType={loadedDocument.document.mimeType}
              page={currentPage}
              pageCount={loadedDocument.document.pageCount}
              activePage={activePage}
              highlight={highlight}
              onPageChange={setActivePage}
            />
          </section>
          <Splitter />
          <section className="teacher-pane" aria-label="Teacher voice call">
            <TeacherPanel
              messages={messages}
              isStreaming={isStreaming}
              isSpeaking={isSpeaking}
              isListening={isListening}
              isTranscribing={isTranscribing}
              micSupported={micSupported}
              callMode={callMode}
              voiceEnabled={voiceEnabled}
              error={error}
              onVoiceToggle={() => {
                stopSpeaking();
                setVoiceEnabled((value) => !value);
              }}
              onMicToggle={() => {
                if (isListening) {
                  stopListening();
                } else {
                  stopSpeaking();
                  startListening();
                }
              }}
              onClearChat={clearChat}
              onCallToggle={() => {
                if (callMode) {
                  setCallMode(false);
                  callModeRef.current = false;
                  stopListening();
                  stopSpeaking();
                  return;
                }
                if (!micSupported) {
                  setError("Microphone is not supported in this browser.");
                  return;
                }
                setCallMode(true);
                callModeRef.current = true;
                setVoiceEnabled(true);
                if (!hasIntroduced) {
                  setHasIntroduced(true);
                  sendMessage(
                    "Greet the student warmly in 2-3 short sentences. Introduce yourself as their AI teacher for this document. Briefly list what you can do: summarize sections, explain concepts in plain language, quiz them, and answer any question grounded in the document. End by asking what they'd like to start with. Do not include citations or page numbers in this greeting.",
                    { hidden: true }
                  );
                } else {
                  startListening();
                }
              }}
            />
          </section>
        </main>
      ) : (
        <main className="document-pane" style={{ borderRight: 0 }}>
          <UploadPanel
            fileInputRef={fileInputRef}
            uploadState={uploadState}
            error={error}
            isDragOver={isDragOver}
            setDragOver={setIsDragOver}
            onFile={uploadFile}
          />
        </main>
      )}
    </div>
  );
}

function UploadPanel({
  fileInputRef,
  uploadState,
  error,
  isDragOver,
  setDragOver,
  onFile
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploadState: UploadState;
  error: string | null;
  isDragOver: boolean;
  setDragOver: (value: boolean) => void;
  onFile: (file: File | null) => void;
}) {
  if (uploadState === "processing") {
    return (
      <div className="upload-surface surface processing" role="status" aria-live="polite">
        <Loader2 className="spin" size={42} aria-hidden />
        <h2>Reading the document</h2>
        <p>Extracting pages, building lesson passages, and preparing the teacher.</p>
      </div>
    );
  }

  return (
    <div className="upload-surface surface">
      <label
        className={`drop-target${isDragOver ? " is-drag-over" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isDragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          onFile(event.dataTransfer.files.item(0));
        }}
      >
        <UploadCloud size={42} aria-hidden />
        <div>
          <h2>Upload a Lesson Source</h2>
          <p>PDF, text, and markdown files up to 25MB.</p>
        </div>
        <div className="button-row">
          <span className="button primary">
            <UploadCloud size={18} aria-hidden />
            Choose file
          </span>
        </div>
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
          onChange={(event) => onFile(event.target.files?.item(0) ?? null)}
        />
      </label>
      {error ? (
        <p className="error-text" role="alert">
          <AlertTriangle size={16} aria-hidden /> {error}
        </p>
      ) : null}
    </div>
  );
}

function DocumentBoard({
  fileUrl,
  mimeType,
  page,
  pageCount,
  activePage,
  highlight,
  onPageChange
}: {
  fileUrl: string | null;
  mimeType: string;
  page: DocumentPage | null;
  pageCount: number;
  activePage: number;
  highlight: Reference | null;
  onPageChange: (page: number) => void;
}) {
  const isPdf = mimeType === "application/pdf" && !!fileUrl;
  const pdfSrc = isPdf
    ? `${fileUrl}#page=${activePage}&view=FitH&toolbar=0&navpanes=0`
    : null;

  return (
    <div className="document-board">
      <div className="board-toolbar surface">
        <div className="board-title">
          <h2>Page {activePage}</h2>
          <p>{highlight ? "Reference selected by the teacher" : "Original document"}</p>
        </div>
        <div className="button-row">
          <button
            className="icon-button"
            type="button"
            title="Previous page"
            disabled={activePage <= 1}
            onClick={() => onPageChange(Math.max(1, activePage - 1))}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span className="pill">
            {activePage} / {pageCount}
          </span>
          <button
            className="icon-button"
            type="button"
            title="Next page"
            disabled={activePage >= pageCount}
            onClick={() => onPageChange(Math.min(pageCount, activePage + 1))}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
          {fileUrl ? (
            <a className="button" href={fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={17} aria-hidden />
              Open
            </a>
          ) : null}
        </div>
      </div>
      <div className="page-shell">
        {isPdf ? (
          <div className="pdf-frame">
            <iframe
              key={activePage}
              src={pdfSrc ?? undefined}
              title={`Document page ${activePage}`}
              className="pdf-iframe"
            />
            {highlight && highlight.pageNumber === activePage ? (
              <aside className="reference-note pdf-overlay">
                <strong>Teacher reference</strong>
                <span>{highlight.snippet}</span>
              </aside>
            ) : null}
          </div>
        ) : (
          <article className="page-paper">
            {page ? renderHighlightedText(page.text, highlight?.pageNumber === page.pageNumber ? highlight.snippet : null) : "No page text."}
            {highlight && highlight.pageNumber === page?.pageNumber ? (
              <aside className="reference-note">{highlight.snippet}</aside>
            ) : null}
          </article>
        )}
      </div>
    </div>
  );
}

function Splitter() {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;

    function setSplit(clientX: number) {
      const workspace = document.querySelector<HTMLElement>(".workspace");
      if (!workspace) return;
      const rect = workspace.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const clamped = Math.min(0.85, Math.max(0.25, ratio));
      workspace.style.setProperty("--split", `${(clamped * 100).toFixed(2)}%`);
    }

    function onMove(e: MouseEvent) {
      e.preventDefault();
      setSplit(e.clientX);
    }
    function onTouch(e: TouchEvent) {
      const t = e.touches[0];
      if (t) setSplit(t.clientX);
    }
    function stop() {
      setDragging(false);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", stop);
    document.addEventListener("touchmove", onTouch, { passive: true });
    document.addEventListener("touchend", stop);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", stop);
      document.removeEventListener("touchmove", onTouch);
      document.removeEventListener("touchend", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  return (
    <div
      className={`splitter${dragging ? " is-dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize document and chat panes"
      tabIndex={0}
      onMouseDown={() => setDragging(true)}
      onTouchStart={() => setDragging(true)}
      onDoubleClick={() => {
        const ws = document.querySelector<HTMLElement>(".workspace");
        ws?.style.removeProperty("--split");
      }}
      onKeyDown={(e) => {
        const ws = document.querySelector<HTMLElement>(".workspace");
        if (!ws) return;
        const current = parseFloat(
          getComputedStyle(ws).getPropertyValue("--split") || "60"
        );
        if (e.key === "ArrowLeft") {
          ws.style.setProperty("--split", `${Math.max(25, current - 2)}%`);
        } else if (e.key === "ArrowRight") {
          ws.style.setProperty("--split", `${Math.min(85, current + 2)}%`);
        }
      }}
    >
      <span className="splitter-grip" aria-hidden />
    </div>
  );
}

function TeacherAvatar({ state }: { state: string }) {
  return (
    <div className={`avatar-stage avatar--${state}`} aria-hidden>
      <span className="halo halo--1" />
      <span className="halo halo--2" />
      <svg
        className="teacher-svg"
        viewBox="0 0 200 220"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="face" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fde3c8" />
            <stop offset="60%" stopColor="#f5c79b" />
            <stop offset="100%" stopColor="#d99a6a" />
          </radialGradient>
          <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2a1f" />
            <stop offset="100%" stopColor="#1f1410" />
          </linearGradient>
          <linearGradient id="suit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f7cc7" />
            <stop offset="100%" stopColor="#1f3f7a" />
          </linearGradient>
          <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff9b8a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff9b8a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* shoulders / suit */}
        <path
          d="M30 220 C 40 175, 70 160, 100 160 C 130 160, 160 175, 170 220 Z"
          fill="url(#suit)"
        />
        <path
          d="M88 162 L100 178 L112 162 L108 200 L92 200 Z"
          fill="#f5f1ea"
        />
        <circle cx="100" cy="186" r="3.5" fill="#3f7cc7" />

        {/* neck */}
        <rect x="88" y="148" width="24" height="18" rx="6" fill="#e5b489" />

        {/* head */}
        <g className="head">
          <circle cx="100" cy="100" r="52" fill="url(#face)" />
          {/* hair */}
          <path
            d="M52 92 C 55 55, 95 40, 130 50 C 152 56, 153 80, 150 96 C 138 80, 120 76, 100 78 C 82 80, 68 86, 56 100 Z"
            fill="url(#hair)"
          />
          {/* ears */}
          <ellipse cx="51" cy="104" rx="6" ry="9" fill="#e5b489" />
          <ellipse cx="149" cy="104" rx="6" ry="9" fill="#e5b489" />

          {/* cheeks */}
          <circle cx="74" cy="116" r="9" fill="url(#cheek)" />
          <circle cx="126" cy="116" r="9" fill="url(#cheek)" />

          {/* eyes (with blink) */}
          <g className="eye eye--left">
            <ellipse cx="82" cy="102" rx="6.5" ry="7.5" fill="#fff" />
            <circle className="pupil" cx="82" cy="103" r="3.4" fill="#1c1a17" />
            <circle cx="83.5" cy="101" r="1.1" fill="#fff" />
          </g>
          <g className="eye eye--right">
            <ellipse cx="118" cy="102" rx="6.5" ry="7.5" fill="#fff" />
            <circle className="pupil" cx="118" cy="103" r="3.4" fill="#1c1a17" />
            <circle cx="119.5" cy="101" r="1.1" fill="#fff" />
          </g>

          {/* eyebrows */}
          <path d="M73 91 Q 82 87 91 91" stroke="#2b1d15" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M109 91 Q 118 87 127 91" stroke="#2b1d15" strokeWidth="2.2" strokeLinecap="round" fill="none" />

          {/* glasses */}
          <g fill="none" stroke="#1c1a17" strokeWidth="2">
            <circle cx="82" cy="102" r="11" />
            <circle cx="118" cy="102" r="11" />
            <path d="M93 102 L 107 102" />
            <path d="M71 99 L 60 96" />
            <path d="M129 99 L 140 96" />
          </g>

          {/* nose */}
          <path d="M100 110 Q 96 122 100 126 Q 104 124 102 120" stroke="#b9805a" strokeWidth="1.6" fill="none" strokeLinecap="round" />

          {/* mouth */}
          <g className="mouth">
            <ellipse className="mouth-shape" cx="100" cy="138" rx="9" ry="3" fill="#3a1a18" />
            <rect className="mouth-line" x="92" y="137" width="16" height="2.4" rx="1.2" fill="#3a1a18" />
            <path className="tongue" d="M94 139 Q 100 144 106 139 Z" fill="#d24a4a" />
          </g>
        </g>

        {/* tiny AI antenna */}
        <g className="antenna">
          <line x1="100" y1="48" x2="100" y2="36" stroke="#2b1d15" strokeWidth="2" strokeLinecap="round" />
          <circle cx="100" cy="33" r="4" fill="#2dd4a4">
            <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>

      <div className="wave" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} style={{ ["--i" as never]: i }} />
        ))}
      </div>
    </div>
  );
}

function TeacherPanel({
  messages,
  isStreaming,
  isSpeaking,
  isListening,
  isTranscribing,
  micSupported,
  callMode,
  voiceEnabled,
  error,
  onVoiceToggle,
  onMicToggle,
  onCallToggle,
  onClearChat
}: {
  messages: UiMessage[];
  isStreaming: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  micSupported: boolean;
  callMode: boolean;
  voiceEnabled: boolean;
  error: string | null;
  onVoiceToggle: () => void;
  onMicToggle: () => void;
  onCallToggle: () => void;
  onClearChat: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const orbState = isSpeaking
    ? "speaking"
    : isListening
      ? "listening"
      : isStreaming || isTranscribing
        ? "thinking"
        : callMode
          ? "idle-call"
          : "idle";

  const status = isListening
    ? "Listening — speak now"
    : isTranscribing
      ? "Transcribing…"
      : isStreaming
        ? "Thinking from the document…"
        : isSpeaking
          ? "Speaking"
          : callMode
            ? "On call"
            : messages.length === 0
              ? "Tap Call to start your lesson"
              : "Tap Call to keep going";

  return (
    <div className={`call-stage${callMode ? " in-call" : ""}`}>
      <TeacherAvatar state={orbState} />

      <div className="call-meta">
        <h2>AI Teacher</h2>
        <p role="status" aria-live="polite">{status}</p>
      </div>

      <div ref={logRef} className="call-transcript" aria-live="polite">
        {messages.length === 0 && !callMode ? (
          <p className="call-hint">
            Press <strong>Call</strong>. Your teacher will introduce the lesson and listen for your reply — no typing needed.
          </p>
        ) : (
          messages.filter((m) => !m.hidden).map((message) => (
            <div key={message.id} className={`bubble ${message.role}`}>
              {message.content
                ? renderMessageBody(message.content)
                : message.role === "assistant"
                  ? <span className="thinking-dots" aria-label="Thinking"><i /><i /><i /></span>
                  : ""}
            </div>
          ))
        )}
        {error ? (
          <div className="bubble assistant error-text" role="alert">
            {error}
          </div>
        ) : null}
      </div>

      <div className="call-dock" role="group" aria-label="Call controls">
        <button
          className="dock-btn"
          type="button"
          aria-label={voiceEnabled ? "Mute teacher voice" : "Unmute teacher voice"}
          aria-pressed={!voiceEnabled}
          title={voiceEnabled ? "Mute teacher voice" : "Unmute teacher voice"}
          onClick={onVoiceToggle}
          disabled={!callMode}
        >
          {voiceEnabled ? <Volume2 size={20} aria-hidden /> : <VolumeX size={20} aria-hidden />}
        </button>

        <button
          className={`call-cta ${callMode ? "call-cta--end" : "call-cta--start"}`}
          type="button"
          aria-label={callMode ? "End voice call" : "Start voice call"}
          aria-pressed={callMode}
          onClick={onCallToggle}
          disabled={!micSupported}
        >
          {callMode ? <PhoneOff size={26} aria-hidden /> : <Phone size={26} aria-hidden />}
          <span>{callMode ? "End" : "Call"}</span>
        </button>

        <button
          className="dock-btn"
          type="button"
          aria-label="Clear chat and restart"
          title="Clear chat and restart"
          onClick={() => {
            if (messages.length === 0) {
              onClearChat();
              return;
            }
            const ok =
              typeof window === "undefined"
                ? true
                : window.confirm("Clear the chat and restart the lesson from the beginning?");
            if (ok) onClearChat();
          }}
          disabled={messages.length === 0 && !callMode}
        >
          <RotateCcw size={20} aria-hidden />
        </button>

        <button
          className={`dock-btn${isListening ? " is-on" : ""}`}
          type="button"
          aria-label={isListening ? "Mute microphone" : "Speak now"}
          aria-pressed={isListening}
          title={isListening ? "Mute microphone" : "Speak now"}
          onClick={onMicToggle}
          disabled={!callMode || isStreaming || isTranscribing}
        >
          {isTranscribing ? (
            <Loader2 className="spin" size={20} aria-hidden />
          ) : isListening ? (
            <Mic size={20} aria-hidden />
          ) : (
            <MicOff size={20} aria-hidden />
          )}
        </button>
      </div>

      {!micSupported ? (
        <p className="call-warn">
          <AlertTriangle size={14} aria-hidden /> Microphone is not supported in this browser.
        </p>
      ) : null}
    </div>
  );
}

function renderMessageBody(content: string): ReactNode {
  // Strip simple markdown bold/italic markers and split into paragraphs for readability.
  const cleaned = content.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|\W)\*(.+?)\*(?=\W|$)/g, "$1$2");
  const paragraphs = cleaned.split(/\n{2,}/);
  return paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>);
}

async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const event = parseStreamEvent(part);
      if (event) {
        onEvent(event);
      }
    }
  }
}

function parseStreamEvent(part: string): StreamEvent | null {
  const eventLine = part.split("\n").find((line) => line.startsWith("event: "));
  const dataLine = part.split("\n").find((line) => line.startsWith("data: "));

  if (!eventLine || !dataLine) {
    return null;
  }

  return {
    event: eventLine.replace("event: ", "") as StreamEvent["event"],
    data: JSON.parse(dataLine.replace("data: ", ""))
  } as StreamEvent;
}

function updateMessage(messages: UiMessage[], id: string, patch: Partial<UiMessage>): UiMessage[] {
  return messages.map((message) => (message.id === id ? { ...message, ...patch } : message));
}

function useVoiceRecorder(
  onTranscript: (transcript: string) => void,
  onError: (message: string) => void
) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      typeof window.MediaRecorder !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";
    setIsSupported(ok);
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) {
      onErrorRef.current("Microphone recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        onErrorRef.current("Recording failed. Check your microphone and try again.");
        cleanupStream();
        setIsListening(false);
      };

      recorder.onstop = async () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        cleanupStream();
        if (chunks.length === 0) {
          setIsListening(false);
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setIsListening(false);
        setIsTranscribing(true);
        try {
          const text = await sendAudioForTranscription(blob);
          if (text) {
            onTranscriptRef.current(text);
          }
        } catch (error) {
          onErrorRef.current(error instanceof Error ? error.message : "Transcription failed.");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
    } catch (error) {
      cleanupStream();
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        onErrorRef.current("Microphone permission was blocked. Allow mic access in your browser site settings.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        onErrorRef.current("No microphone was found. Connect one and try again.");
      } else {
        onErrorRef.current(error instanceof Error ? error.message : "Could not start the microphone.");
      }
    }
  }, [cleanupStream, isSupported]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanupStream();
      setIsListening(false);
    }
  }, [cleanupStream]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
      cleanupStream();
    };
  }, [cleanupStream]);

  return { isListening, isTranscribing, isSupported, start, stop };
}

function pickAudioMimeType(): string | null {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4"
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) {
      return type;
    }
  }
  return null;
}

async function sendAudioForTranscription(blob: Blob): Promise<string> {
  const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
  const formData = new FormData();
  formData.append("audio", new File([blob], `recording.${extension}`, { type: blob.type || "audio/webm" }));
  const response = await fetch("/api/transcribe", { method: "POST", body: formData });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Transcription failed.");
  }
  return typeof data.text === "string" ? data.text.trim() : "";
}

function renderHighlightedText(text: string, snippet: string | null): ReactNode {
  if (!snippet) {
    return text;
  }

  const needle = snippet.replaceAll("...", "").trim().slice(0, 140);
  if (!needle) {
    return text;
  }

  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) {
    return text;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + needle.length);
  const after = text.slice(index + needle.length);

  return (
    <>
      {before}
      <mark className="highlight">{match}</mark>
      {after}
    </>
  );
}
