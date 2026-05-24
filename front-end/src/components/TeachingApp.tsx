import { BookOpen, FileText, Phone } from "lucide-react";
import { useEffect, type CSSProperties } from "react";
import { useChatStore } from "@/store/chatStore";
import { selectCurrentPage, useDocumentStore } from "@/store/documentStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSpeechStore } from "@/store/speechStore";
import { useVoiceStore } from "@/store/voiceStore";
import { DocumentBoard } from "./DocumentBoard";
import { LibraryMenu } from "./LibraryMenu";
import { Splitter } from "./Splitter";
import { TeacherPanel } from "./TeacherPanel";
import { UploadPanel } from "./UploadPanel";
import { cx } from "@/lib/uiClasses";

/**
 * Root of the voice tutor workspace. Reads state from the Zustand stores and
 * routes between the upload and teaching views. All cross-cutting
 * orchestration lives in the session store — this component only renders.
 */
export function TeachingApp() {
  // One-time bootstrap: probe microphone support, saved settings, and library.
  useEffect(() => {
    useVoiceStore.getState().init();
    useSessionStore.getState().initSaveCost();
    void useDocumentStore.getState().initLibrary();
  }, []);

  const error = useSessionStore((s) => s.error);
  const callMode = useSessionStore((s) => s.callMode);
  const mobilePane = useSessionStore((s) => s.mobilePane);
  const speechLanguage = useSessionStore((s) => s.speechLanguage);
  const saveCost = useSessionStore((s) => s.saveCost);

  const loadedDocument = useDocumentStore((s) => s.loadedDocument);
  const uploadState = useDocumentStore((s) => s.uploadState);
  const activePage = useDocumentStore((s) => s.activePage);
  const highlight = useDocumentStore((s) => s.highlight);
  const activeCitationKey = useDocumentStore((s) => s.activeCitationKey);
  const currentPage = useDocumentStore(selectCurrentPage);
  const library = useDocumentStore((s) => s.library);
  const libraryLoading = useDocumentStore((s) => s.libraryLoading);
  const deletingId = useDocumentStore((s) => s.deletingId);

  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const caption = useSpeechStore((s) => s.caption);
  const isSpeaking = useSpeechStore((s) => s.isSpeaking);

  const isListening = useVoiceStore((s) => s.isListening);
  const isTranscribing = useVoiceStore((s) => s.isTranscribing);
  const micSupported = useVoiceStore((s) => s.isSupported);
  const micPermission = useVoiceStore((s) => s.permission);

  const session = useSessionStore.getState();
  const documentStore = useDocumentStore.getState();

  const documentPaneClass = cx(
    "h-full min-w-0 overflow-hidden border-r border-line p-[clamp(14px,2vw,26px)] [background:linear-gradient(90deg,oklch(0.91_0.017_84)_1px,transparent_1px)_0_0/36px_36px,var(--color-panel)] max-[920px]:border-r-0",
    loadedDocument && mobilePane === "teacher" && "max-[920px]:hidden"
  );
  const teacherPaneClass = cx(
    "flex h-full min-w-0 overflow-hidden p-[clamp(14px,2vw,26px)] text-[oklch(0.96_0.008_100)] [background:radial-gradient(120%_80%_at_50%_0%,oklch(0.34_0.06_232)_0%,oklch(0.22_0.035_240)_60%,oklch(0.18_0.03_244)_100%)]",
    mobilePane === "document" && "max-[920px]:hidden"
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-line bg-[oklch(0.985_0.009_86/0.92)] px-[clamp(12px,3vw,34px)] py-2.5 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid h-[38px] w-[38px] flex-none place-items-center rounded-lg bg-teacher text-paper-strong">
            <BookOpen size={21} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="m-0 truncate text-[clamp(0.95rem,1.6vw,1.2rem)] font-[760] leading-[1.15]">
              AI Voice Tutor for Documents
            </h1>
            <p className="mb-0 mt-[3px] truncate text-[0.82rem] text-muted">
              {loadedDocument ? loadedDocument.document.title : "Document learning board"}
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center justify-end gap-2">
          <LibraryMenu
            library={library}
            libraryLoading={libraryLoading}
            activeId={loadedDocument?.document.id ?? null}
            uploadState={uploadState}
            deletingId={deletingId}
            onSelect={session.handleSwitchDocument}
            onFile={session.handleUpload}
            onDelete={documentStore.deleteDocument}
          />
        </div>
      </header>

      {loadedDocument ? (
        <>
          <nav
            className="hidden gap-1.5 border-b border-line bg-paper-strong px-[clamp(12px,3vw,20px)] py-2 max-[920px]:flex"
            role="tablist"
            aria-label="Switch view"
          >
            <button
              type="button"
              role="tab"
              id="tab-document"
              aria-selected={mobilePane === "document"}
              aria-controls="pane-document"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-lg border border-line bg-panel text-[0.9rem] font-[650] text-muted transition-[background,color,border-color] duration-140 ease-out aria-selected:border-teacher aria-selected:bg-teacher aria-selected:text-paper-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => session.setMobilePane("document")}
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
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-lg border border-line bg-panel text-[0.9rem] font-[650] text-muted transition-[background,color,border-color] duration-140 ease-out aria-selected:border-teacher aria-selected:bg-teacher aria-selected:text-paper-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => session.setMobilePane("teacher")}
            >
              <Phone size={16} aria-hidden />
              Teacher
            </button>
          </nav>
          <main
            className="grid min-h-0 flex-1 grid-cols-[var(--split)_8px_1fr] overflow-hidden [--split:60%] max-[920px]:grid-cols-1 max-[920px]:grid-rows-1"
            data-pane={mobilePane}
            data-workspace
          >
            <section
              className={documentPaneClass}
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
                activeCitationKey={activeCitationKey}
                isLoading={uploadState === "processing"}
                onPageChange={documentStore.setActivePage}
                onFocusCitation={documentStore.focusCitation}
              />
            </section>
            <Splitter />
            <section
              className={teacherPaneClass}
              id="pane-teacher"
              aria-labelledby="tab-teacher"
              aria-label="Teacher voice call"
            >
              <TeacherPanel
                messages={messages}
                caption={caption}
                isStreaming={isStreaming}
                isSpeaking={isSpeaking}
                isListening={isListening}
                isTranscribing={isTranscribing}
                micSupported={micSupported}
                micBlocked={micPermission === "denied"}
                callMode={callMode}
                speechLanguage={speechLanguage}
                saveCost={saveCost}
                error={error}
                onSpeechLanguageChange={session.setSpeechLanguage}
                onSaveCostToggle={session.toggleSaveCost}
                onMicToggle={session.handleMicToggle}
                onCallToggle={session.handleCallToggle}
                onClearChat={session.clearChat}
              />
            </section>
          </main>
        </>
      ) : (
        <main
          className="h-full min-w-0 overflow-hidden p-[clamp(14px,2vw,26px)] [background:linear-gradient(90deg,oklch(0.91_0.017_84)_1px,transparent_1px)_0_0/36px_36px,var(--color-panel)]"
          style={{ "--color-panel": "oklch(0.96 0.01 84)" } as CSSProperties}
        >
          <UploadPanel
            uploadState={uploadState}
            error={error}
            library={library}
            libraryLoading={libraryLoading}
            deletingId={deletingId}
            onFile={session.handleUpload}
            onSelect={session.handleSwitchDocument}
            onDelete={documentStore.deleteDocument}
          />
        </main>
      )}
    </div>
  );
}
