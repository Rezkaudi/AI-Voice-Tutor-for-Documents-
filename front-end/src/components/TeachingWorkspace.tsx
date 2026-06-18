import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { paths } from "@/routes/paths";
import { useChatStore } from "@/store/chatStore";
import { useDocumentStore } from "@/store/documentStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSpeechStore } from "@/store/speechStore";
import { useVoiceStore } from "@/store/voiceStore";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cx } from "@/lib/uiClasses";
import { CallOverlay } from "./CallOverlay";
import { DocumentBoard } from "./DocumentBoard";
import { Splitter } from "./Splitter";
import { TeacherPanel } from "./TeacherPanel";
import { WorkspaceMenu } from "./WorkspaceMenu";

/** Viewport at/above which the desktop split-pane layout is used. */
const DESKTOP_QUERY = "(min-width: 920px)";

/**
 * The teaching view shown once a document is loaded. Two layouts share the same
 * stores:
 *  - Desktop (≥920px): the classic split pane — document board on the left, the
 *    teacher voice-call panel on the right.
 *  - Mobile (<920px): a document-first surface with a floating draggable avatar
 *    and a bottom control dock.
 */
export function TeachingWorkspace() {
  const callMode = useSessionStore((s) => s.callMode);
  const speechLanguage = useSessionStore((s) => s.speechLanguage);
  const error = useSessionStore((s) => s.error);
  const selectedPages = useSessionStore((s) => s.selectedPages);
  const pageDialogOpen = useSessionStore((s) => s.pageDialogOpen);
  const showTranscript = useSessionStore((s) => s.showTranscript);
  const showCaption = useSessionStore((s) => s.showCaption);

  const loadedDocument = useDocumentStore((s) => s.loadedDocument);
  const uploadState = useDocumentStore((s) => s.uploadState);
  const activePage = useDocumentStore((s) => s.activePage);
  const highlight = useDocumentStore((s) => s.highlight);
  const activeCitationKey = useDocumentStore((s) => s.activeCitationKey);

  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const caption = useSpeechStore((s) => s.caption);
  const isSpeaking = useSpeechStore((s) => s.isSpeaking);

  const isListening = useVoiceStore((s) => s.isListening);
  const isTranscribing = useVoiceStore((s) => s.isTranscribing);
  const micSupported = useVoiceStore((s) => s.isSupported);
  const micPermission = useVoiceStore((s) => s.permission);

  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const navigate = useNavigate();

  const session = useSessionStore.getState();
  const documentStore = useDocumentStore.getState();

  // Leaving the workspace: tear the lesson down, then route to the library.
  const handleBack = () => {
    session.closeDocument();
    navigate(paths.library);
  };

  if (!loadedDocument) return null;

  const micBlocked = micPermission === "denied";

  const documentBoard = (
    <DocumentBoard
      fileUrl={loadedDocument.fileUrl}
      mimeType={loadedDocument.document.mimeType}
      pageCount={loadedDocument.document.pageCount}
      activePage={activePage}
      highlight={highlight}
      activeCitationKey={activeCitationKey}
      isLoading={uploadState === "processing"}
      onPageChange={documentStore.setActivePage}
      onFocusCitation={documentStore.focusCitation}
    />
  );

  const backButton = (
    <button
      type="button"
      className={cx(
        "absolute left-4 top-4 z-30 inline-flex h-10 items-center rounded-full text-[0.85rem] font-semibold tracking-[0.01em]",
        "border border-line bg-paper-strong/90 text-ink shadow-app backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]",
        "transition-[transform,background,border-color] duration-200 ease-out",
        "[&:hover:not(:disabled)]:-translate-y-px [&:hover:not(:disabled)]:border-accent/60",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        isDesktop ? "gap-2 px-4" : "w-10 justify-center"
      )}
      aria-label="Back to documents"
      title="Back to documents"
      onClick={handleBack}
    >
      <ArrowLeft size={isDesktop ? 16 : 18} aria-hidden />
      {isDesktop ? <span>Documents</span> : null}
    </button>
  );

  const restartDisabled = messages.length === 0 && !callMode;

  const workspaceMenu = (
    <WorkspaceMenu
      showTranscript={showTranscript}
      showCaption={showCaption}
      restartDisabled={restartDisabled}
      onEditPages={session.openPageDialog}
      onToggleTranscript={session.toggleTranscript}
      onToggleCaption={session.toggleCaption}
      onRestart={session.clearChat}
    />
  );

  // ----- Desktop: split pane (document + teacher panel) -----
  if (isDesktop) {
    const documentPaneClass = cx(
      "relative h-full min-w-0 overflow-hidden pr-2",
      "[background:linear-gradient(90deg,oklch(0.91_0.017_84)_1px,transparent_1px)_0_0/36px_36px,var(--color-panel)]"
    );
    const teacherPaneClass =
      "relative flex h-full min-w-0 overflow-hidden p-[clamp(14px,2vw,26px)] text-[oklch(0.96_0.008_100)] [background:radial-gradient(120%_80%_at_50%_0%,oklch(0.34_0.06_232)_0%,oklch(0.22_0.035_240)_60%,oklch(0.18_0.03_244)_100%)]";

    return (
      <main
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,var(--split))_8px_minmax(400px,1fr)] overflow-hidden [--split:81.3%]"
        data-workspace
      >
        <section className={documentPaneClass} aria-label="Document board">
          {backButton}
          {documentBoard}
        </section>
        <Splitter />
        <section className={teacherPaneClass} aria-label="Teacher voice call">
          {workspaceMenu}
          <TeacherPanel
            messages={messages}
            caption={caption}
            isStreaming={isStreaming}
            isSpeaking={isSpeaking}
            isListening={isListening}
            isTranscribing={isTranscribing}
            micSupported={micSupported}
            micBlocked={micBlocked}
            callMode={callMode}
            speechLanguage={speechLanguage}
            showTranscript={showTranscript}
            showCaption={showCaption}
            error={error}
            pageCount={loadedDocument.document.pageCount}
            selectedPages={selectedPages}
            pageDialogOpen={pageDialogOpen}
            onSpeechLanguageChange={session.setSpeechLanguage}
            onMicToggle={session.handleMicToggle}
            onCallToggle={session.handleCallToggle}
            onClosePageDialog={session.closePageDialog}
            onSubmitPageSelection={session.submitPageSelection}
          />
        </section>
      </main>
    );
  }

  // ----- Mobile: document-first surface with floating teacher overlay -----
  return (
    <main
      className="relative min-h-0 flex-1 overflow-hidden [background:linear-gradient(90deg,oklch(0.91_0.017_84)_1px,transparent_1px)_0_0/36px_36px,var(--color-panel)]"
      data-workspace
    >
      <section
        className="h-full overflow-hidden"
        aria-label="Document board"
      >
        {backButton}
        {documentBoard}
      </section>

      <CallOverlay
        messages={messages}
        caption={caption}
        isStreaming={isStreaming}
        isSpeaking={isSpeaking}
        isListening={isListening}
        isTranscribing={isTranscribing}
        micSupported={micSupported}
        micBlocked={micBlocked}
        callMode={callMode}
        error={error}
        pageCount={loadedDocument.document.pageCount}
        selectedPages={selectedPages}
        pageDialogOpen={pageDialogOpen}
        showTranscript={showTranscript}
        showCaption={showCaption}
        onMicToggle={session.handleMicToggle}
        onCallToggle={session.handleCallToggle}
        onClearChat={session.clearChat}
        onEditPages={session.openPageDialog}
        onToggleTranscript={session.toggleTranscript}
        onToggleCaption={session.toggleCaption}
        onClosePageDialog={session.closePageDialog}
        onSubmitPageSelection={session.submitPageSelection}
      />
    </main>
  );
}
