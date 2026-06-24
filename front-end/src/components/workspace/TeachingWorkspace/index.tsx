import { DocumentBoard } from "../DocumentBoard";
import { DocumentLoadingOverlay } from "../DocumentLoadingOverlay";
import { WorkspaceMenu } from "../WorkspaceMenu";
import { DesktopLayout } from "./DesktopLayout";
import { MobileLayout } from "./MobileLayout";
import { useWorkspaceState } from "./useWorkspaceState";

/**
 * The teaching view shown once a document is loaded. Reads the shared workspace
 * state, then renders one of two layouts that drive the same stores:
 *  - Desktop (≥920px): the classic split pane — document board + teacher panel.
 *  - Mobile (<920px): a document-first surface with a floating draggable avatar.
 */
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

  // Covers the whole workspace (controls included) so nothing flashes in early.
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

  return vm.isDesktop ? (
    <DesktopLayout
      vm={vm}
      documentBoard={documentBoard}
      workspaceMenu={workspaceMenu}
      loadingCover={loadingCover}
    />
  ) : (
    <MobileLayout vm={vm} documentBoard={documentBoard} loadingCover={loadingCover} />
  );
}
