import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CallOverlay } from "@/components/workspace/teacher/CallOverlay";
import { BackButton } from "./BackButton";
import type { WorkspaceState } from "@/hooks/workspace/useWorkspaceState";

interface MobileLayoutProps {
  vm: WorkspaceState;
  documentBoard: ReactNode;
  loadingCover: ReactNode;
  questionPopup: ReactNode;
}

export function MobileLayout({ vm, documentBoard, loadingCover, questionPopup }: MobileLayoutProps) {
  const { t } = useTranslation();
  const { session } = vm;
  return (
    <main
      dir="ltr"
      className="relative min-h-0 flex-1 overflow-hidden [background:linear-gradient(90deg,oklch(0.91_0.017_84)_1px,transparent_1px)_0_0/36px_36px,var(--color-panel)]"
      data-workspace
    >
      <section className="relative h-full overflow-hidden" aria-label={t("workspace.documentBoard")}>
        <BackButton isDesktop={false} onBack={vm.handleBack} />
        {documentBoard}
        {questionPopup}
      </section>

      <CallOverlay
        messages={vm.messages}
        caption={vm.caption}
        isStreaming={vm.isStreaming}
        isSpeaking={vm.isSpeaking}
        isListening={vm.isListening}
        isTranscribing={vm.isTranscribing}
        micSupported={vm.micSupported}
        micBlocked={vm.micBlocked}
        callMode={vm.callMode}
        error={vm.error}
        pageCount={vm.pageCount}
        selectedPages={vm.selectedPages}
        pageDialogOpen={vm.pageDialogOpen}
        showTranscript={vm.showTranscript}
        showCaption={vm.showCaption}
        onMicToggle={session.handleMicToggle}
        onCallToggle={session.handleCallToggle}
        onClearChat={session.clearChat}
        onEditPages={session.openPageDialog}
        onToggleTranscript={session.toggleTranscript}
        onToggleCaption={session.toggleCaption}
        onClosePageDialog={session.closePageDialog}
        onSubmitPageSelection={session.submitPageSelection}
      />
      {loadingCover}
    </main>
  );
}
