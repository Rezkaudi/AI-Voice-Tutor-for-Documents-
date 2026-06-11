import { useChatStore } from "@/store/chatStore";
import { useDocumentStore } from "@/store/documentStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSpeechStore } from "@/store/speechStore";
import { useVoiceStore } from "@/store/voiceStore";
import { cx } from "@/lib/uiClasses";
import { DocumentBoard } from "./DocumentBoard";
import { MobilePaneTabs } from "./MobilePaneTabs";
import { Splitter } from "./Splitter";
import { TeacherPanel } from "./TeacherPanel";

/**
 * The split-pane teaching view shown once a document is loaded: the document
 * board on the left and the teacher voice call on the right, with mobile tabs
 * toggling between them on narrow screens.
 */
export function TeachingWorkspace() {
  const mobilePane = useSessionStore((s) => s.mobilePane);
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

  const session = useSessionStore.getState();
  const documentStore = useDocumentStore.getState();

  if (!loadedDocument) return null;

  const documentPaneClass = cx(
    "h-full min-w-0 overflow-hidden border-r border-line p-[clamp(14px,2vw,26px)] [background:linear-gradient(90deg,oklch(0.91_0.017_84)_1px,transparent_1px)_0_0/36px_36px,var(--color-panel)] max-[920px]:border-r-0",
    mobilePane === "teacher" && "max-[920px]:hidden"
  );
  const teacherPaneClass = cx(
    "flex h-full min-w-0 overflow-hidden p-[clamp(14px,2vw,26px)] text-[oklch(0.96_0.008_100)] [background:radial-gradient(120%_80%_at_50%_0%,oklch(0.34_0.06_232)_0%,oklch(0.22_0.035_240)_60%,oklch(0.18_0.03_244)_100%)]",
    mobilePane === "document" && "max-[920px]:hidden"
  );

  return (
    <>
      <MobilePaneTabs />
      <main
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,var(--split))_8px_minmax(400px,1fr)] overflow-hidden [--split:81.3%] max-[920px]:grid-cols-1 max-[920px]:grid-rows-1"
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
            pageCount={loadedDocument.document.pageCount}
            activePage={activePage}
            highlight={highlight}
            activeCitationKey={activeCitationKey}
            isLoading={uploadState === "processing"}
            onPageChange={documentStore.setActivePage}
            onFocusCitation={documentStore.focusCitation}
            onEditPages={session.openPageDialog}
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
    </>
  );
}
