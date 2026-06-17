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
  const saveCost = useSessionStore((s) => s.saveCost);
  const error = useSessionStore((s) => s.error);
  const selectedPages = useSessionStore((s) => s.selectedPages);
  const pageDialogOpen = useSessionStore((s) => s.pageDialogOpen);

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

  const session = useSessionStore.getState();
  const documentStore = useDocumentStore.getState();

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
      onEditPages={session.openPageDialog}
    />
  );

  // ----- Desktop: split pane (document + teacher panel) -----
  if (isDesktop) {
    const documentPaneClass = cx(
      "h-full min-w-0 overflow-hidden border-r border-line p-[clamp(14px,2vw,26px)]",
      "[background:linear-gradient(90deg,oklch(0.91_0.017_84)_1px,transparent_1px)_0_0/36px_36px,var(--color-panel)]"
    );
    const teacherPaneClass =
      "flex h-full min-w-0 overflow-hidden p-[clamp(14px,2vw,26px)] text-[oklch(0.96_0.008_100)] [background:radial-gradient(120%_80%_at_50%_0%,oklch(0.34_0.06_232)_0%,oklch(0.22_0.035_240)_60%,oklch(0.18_0.03_244)_100%)]";

    return (
      <main
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,var(--split))_8px_minmax(400px,1fr)] overflow-hidden [--split:81.3%]"
        data-workspace
      >
        <section className={documentPaneClass} aria-label="Document board">
          {documentBoard}
        </section>
        <Splitter />
        <section className={teacherPaneClass} aria-label="Teacher voice call">
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
            saveCost={saveCost}
            error={error}
            pageCount={loadedDocument.document.pageCount}
            selectedPages={selectedPages}
            pageDialogOpen={pageDialogOpen}
            onSpeechLanguageChange={session.setSpeechLanguage}
            onSaveCostToggle={session.toggleSaveCost}
            onMicToggle={session.handleMicToggle}
            onCallToggle={session.handleCallToggle}
            onClearChat={session.clearChat}
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
        className="h-full overflow-hidden px-[clamp(10px,2vw,24px)] pb-[120px] pt-[clamp(10px,1.6vh,18px)]"
        aria-label="Document board"
      >
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
        onMicToggle={session.handleMicToggle}
        onCallToggle={session.handleCallToggle}
        onClearChat={session.clearChat}
        onClosePageDialog={session.closePageDialog}
        onSubmitPageSelection={session.submitPageSelection}
      />
    </main>
  );
}
