import { DocumentBoard } from "../DocumentBoard";
import { DocumentLoadingOverlay } from "../DocumentLoadingOverlay";
import { WorkspaceMenu } from "../WorkspaceMenu";
import { QuestionPopup } from "../teacher/QuestionPopup";
import { DesktopLayout } from "./DesktopLayout";
import { MobileLayout } from "./MobileLayout";
import { useWorkspaceState } from "@/hooks/workspace/useWorkspaceState";

export function TeachingWorkspace() {
  const vm = useWorkspaceState();
  const { loadedDocument, session, documentStore } = vm;

  if (!loadedDocument) return null;

  const documentBoard = (
    <DocumentBoard
      fileUrl={loadedDocument.fileUrl}
      mimeType={loadedDocument.document.mimeType}
      pageCount={loadedDocument.document.pageCount}
      activePage={vm.activePage}
      highlight={vm.highlight}
      activeCitationKey={vm.activeCitationKey}
      onPageChange={documentStore.setActivePage}
      onFocusCitation={documentStore.focusCitation}
      onReady={vm.handleBoardReady}
    />
  );

  const loadingCover = vm.showLoadingCover ? (
    <div className="absolute inset-0 z-60 bg-paper">
      <DocumentLoadingOverlay />
    </div>
  ) : null;

  const workspaceMenu = (
    <WorkspaceMenu
      showTranscript={vm.showTranscript}
      showCaption={vm.showCaption}
      restartDisabled={vm.restartDisabled}
      onEditPages={session.openPageDialog}
      onToggleTranscript={session.toggleTranscript}
      onToggleCaption={session.toggleCaption}
      onRestart={session.clearChat}
    />
  );

  const questionPopup = (
    <QuestionPopup
      question={vm.pendingQuestion}
      isListening={vm.isListening}
      isTranscribing={vm.isTranscribing}
      onDismiss={session.dismissQuestion}
    />
  );

  return vm.isDesktop ? (
    <DesktopLayout
      vm={vm}
      documentBoard={documentBoard}
      workspaceMenu={workspaceMenu}
      loadingCover={loadingCover}
      questionPopup={questionPopup}
    />
  ) : (
    <MobileLayout
      vm={vm}
      documentBoard={documentBoard}
      loadingCover={loadingCover}
      questionPopup={questionPopup}
    />
  );
}
