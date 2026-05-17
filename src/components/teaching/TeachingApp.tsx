"use client";

import { BookOpen, FileText, Phone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccess } from "@/hooks/use-access";
import { useDocument } from "@/hooks/use-document";
import { useSpeech } from "@/hooks/use-speech";
import { useTutorChat } from "@/hooks/use-tutor-chat";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { GREETING_PROMPT } from "@/lib/prompts";
import { AccessScreen } from "./AccessScreen";
import { DocumentBoard } from "./DocumentBoard";
import { Splitter } from "./Splitter";
import { TeacherPanel } from "./TeacherPanel";
import type { MobilePane } from "./types";
import { UploadPanel } from "./UploadPanel";

// Gap before listening resumes so playback fully releases the audio device.
const CALL_RESUME_DELAY_MS = 350;

/**
 * Root of the voice tutor workspace. Composes the access, document, speech,
 * chat, and voice-recorder hooks and wires their cross-cutting interactions
 * (call mode, lesson greeting, transcript clearing).
 */
export function TeachingApp() {
  const [error, setError] = useState<string | null>(null);
  const [callMode, setCallMode] = useState(false);
  const [hasIntroduced, setHasIntroduced] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("teacher");
  const [speechLanguage, setSpeechLanguage] = useState("ja");

  // Refs mirror state for callbacks that must read the latest value without
  // being re-created (audio event handlers, deferred timers, the voice hook).
  const callModeRef = useRef(false);
  const speechLanguageRef = useRef(speechLanguage);
  const isStreamingRef = useRef(false);
  const sendMessageRef = useRef<(content: string, options?: { hidden?: boolean }) => void>(
    () => {}
  );

  useEffect(() => {
    speechLanguageRef.current = speechLanguage;
  }, [speechLanguage]);
  useEffect(() => {
    callModeRef.current = callMode;
  }, [callMode]);

  const getLanguage = useCallback(() => speechLanguageRef.current, []);

  const speech = useSpeech();
  const access = useAccess({ onError: setError });
  const documentWorkspace = useDocument({ onError: setError });

  const handleVoiceTranscript = useCallback((transcript: string) => {
    const trimmed = transcript.trim();
    if (trimmed) {
      sendMessageRef.current(trimmed);
    }
  }, []);

  const voice = useVoiceRecorder(handleVoiceTranscript, setError, getLanguage);

  const maybeContinueCall = useCallback(() => {
    if (!callModeRef.current) return;
    setTimeout(() => {
      if (callModeRef.current && !isStreamingRef.current) {
        voice.start();
      }
    }, CALL_RESUME_DELAY_MS);
  }, [voice]);

  const chat = useTutorChat({
    loadedDocument: documentWorkspace.loadedDocument,
    speech,
    getLanguage,
    onReference: documentWorkspace.applyReference,
    onError: setError,
    onAnswerComplete: maybeContinueCall
  });

  useEffect(() => {
    isStreamingRef.current = chat.isStreaming;
  }, [chat.isStreaming]);
  // Keep the ref fresh so the voice hook can auto-send on a final transcript.
  useEffect(() => {
    sendMessageRef.current = chat.sendMessage;
  });

  const clearChat = useCallback(() => {
    chat.resetMessages();
    documentWorkspace.applyReference(null);
    setHasIntroduced(false);
    setError(null);
    if (callModeRef.current) {
      setCallMode(false);
      callModeRef.current = false;
      voice.cancel();
    }
    speech.stopSpeaking();
  }, [chat, documentWorkspace, speech, voice]);

  const handleMicToggle = useCallback(() => {
    if (voice.isListening) {
      voice.stop();
    } else {
      speech.stopSpeaking();
      voice.start();
    }
  }, [speech, voice]);

  const handleCallToggle = useCallback(async () => {
    if (callMode) {
      setCallMode(false);
      callModeRef.current = false;
      // End the call: abort every in-flight request — chat stream,
      // transcription, and TTS — alongside stopping the mic and playback.
      chat.abort();
      voice.cancel();
      speech.stopSpeaking();
      return;
    }

    if (!voice.isSupported) {
      setError("Microphone is not supported in this browser.");
      return;
    }

    // Ask for the mic up front, on this click. While the permission is still
    // "prompt" the browser shows its native dialog here — the one chance for a
    // clean one-click grant before the user can block it. If it fails, the
    // blocked-mic popup guides them; don't enter call mode without a mic.
    const granted = await voice.requestPermission();
    if (!granted) {
      return;
    }

    setCallMode(true);
    callModeRef.current = true;

    if (!hasIntroduced) {
      setHasIntroduced(true);
      chat.sendMessage(GREETING_PROMPT, { hidden: true });
    } else {
      voice.start();
    }
  }, [callMode, chat, hasIntroduced, speech, voice]);

  const handleUpload = useCallback(
    (file: File | null) => {
      chat.resetMessages();
      documentWorkspace.uploadFile(file);
    },
    [chat, documentWorkspace]
  );

  if (access.accessState !== "granted") {
    return (
      <AccessScreen
        state={access.accessState}
        accessCode={access.accessCode}
        error={error}
        onAccessCodeChange={access.setAccessCode}
        onSubmit={access.submitAccess}
      />
    );
  }

  const { loadedDocument, uploadState, activePage, highlight, currentPage } = documentWorkspace;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <BookOpen size={21} aria-hidden />
          </div>
          <div>
            <h1 className="brand-title">AI Voice Tutor for Documents</h1>
            <p className="brand-subtitle">
              {loadedDocument ? loadedDocument.document.title : "Document learning board"}
            </p>
          </div>
        </div>
        <div className="status-strip">
          {loadedDocument ? (
            <span className="pill">
              <FileText size={15} aria-hidden />
              {`${loadedDocument.document.pageCount} pages`}
            </span>
          ) : null}
        </div>
      </header>

      {loadedDocument ? (
        <>
          <nav className="mobile-tabs" role="tablist" aria-label="Switch view">
            <button
              type="button"
              role="tab"
              id="tab-document"
              aria-selected={mobilePane === "document"}
              aria-controls="pane-document"
              className="mobile-tab"
              onClick={() => setMobilePane("document")}
            >
              <FileText size={16} aria-hidden />
              Document
            </button>
            <button
              type="button"
              role="tab"
              id="tab-teacher"
              aria-selected={mobilePane === "teacher"}
              aria-controls="pane-teacher"
              className="mobile-tab"
              onClick={() => setMobilePane("teacher")}
            >
              <Phone size={16} aria-hidden />
              Teacher
            </button>
          </nav>
          <main className="workspace" data-pane={mobilePane}>
            <section
              className="document-pane"
              id="pane-document"
              aria-labelledby="tab-document"
              aria-label="Document board"
            >
              <DocumentBoard
                fileUrl={loadedDocument.fileUrl}
                mimeType={loadedDocument.document.mimeType}
                page={currentPage}
                pageCount={loadedDocument.document.pageCount}
                activePage={activePage}
                highlight={highlight}
                onPageChange={documentWorkspace.setActivePage}
              />
            </section>
            <Splitter />
            <section
              className="teacher-pane"
              id="pane-teacher"
              aria-labelledby="tab-teacher"
              aria-label="Teacher voice call"
            >
              <TeacherPanel
                messages={chat.messages}
                documentTitle={loadedDocument.document.title}
                isStreaming={chat.isStreaming}
                isSpeaking={speech.isSpeaking}
                isListening={voice.isListening}
                isTranscribing={voice.isTranscribing}
                micSupported={voice.isSupported}
                micBlocked={voice.permission === "denied"}
                callMode={callMode}
                speechLanguage={speechLanguage}
                error={error}
                onSpeechLanguageChange={setSpeechLanguage}
                onMicToggle={handleMicToggle}
                onCallToggle={handleCallToggle}
                onClearChat={clearChat}
              />
            </section>
          </main>
        </>
      ) : (
        <main className="document-pane" style={{ borderRight: 0 }}>
          <UploadPanel uploadState={uploadState} error={error} onFile={handleUpload} />
        </main>
      )}
    </div>
  );
}
