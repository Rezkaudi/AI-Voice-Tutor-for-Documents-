import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "@/lib/uiClasses";
import { Splitter } from "@/components/common/Splitter";
import { TeacherPanel } from "@/components/workspace/teacher/TeacherPanel";
import { BackButton } from "./BackButton";
import type { WorkspaceState } from "@/hooks/workspace/useWorkspaceState";

interface DesktopLayoutProps {
  vm: WorkspaceState;
  documentBoard: ReactNode;
  workspaceMenu: ReactNode;
  loadingCover: ReactNode;
  questionPopup: ReactNode;
}

const documentPaneClass = cx(
  "relative h-full min-w-0 overflow-hidden pe-2",
  "[background:linear-gradient(90deg,oklch(0.91_0.017_84)_1px,transparent_1px)_0_0/36px_36px,var(--color-panel)]"
);
const teacherPaneClass =
  "relative flex h-full min-w-0 overflow-hidden p-[clamp(14px,2vw,26px)] text-[oklch(0.96_0.008_100)] [background:radial-gradient(120%_80%_at_50%_0%,oklch(0.34_0.06_232)_0%,oklch(0.22_0.035_240)_60%,oklch(0.18_0.03_244)_100%)]";

/** Classic split pane: document board on the left, teacher voice-call panel on the right. */
export function DesktopLayout({
  vm,
  documentBoard,
  workspaceMenu,
  loadingCover,
  questionPopup
}: DesktopLayoutProps) {
  const { t } = useTranslation();
  const { session } = vm;
  return (
    <main
      dir="ltr"
      className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,var(--split))_8px_minmax(400px,1fr)] overflow-hidden [--split:81.3%]"
      data-workspace
    >
      <section className={documentPaneClass} aria-label={t("workspace.documentBoard")}>
        <BackButton isDesktop onBack={vm.handleBack} />
        {documentBoard}
        {questionPopup}
      </section>
      <Splitter />
      <section className={teacherPaneClass} aria-label={t("workspace.teacherCall")}>
        {workspaceMenu}
        <TeacherPanel
          messages={vm.messages}
          caption={vm.caption}
          isStreaming={vm.isStreaming}
          isSpeaking={vm.isSpeaking}
          isListening={vm.isListening}
          isTranscribing={vm.isTranscribing}
          micSupported={vm.micSupported}
          micBlocked={vm.micBlocked}
          callMode={vm.callMode}
          speechLanguage={vm.speechLanguage}
          showTranscript={vm.showTranscript}
          showCaption={vm.showCaption}
          error={vm.error}
          pageCount={vm.pageCount}
          selectedPages={vm.selectedPages}
          pageDialogOpen={vm.pageDialogOpen}
          onSpeechLanguageChange={session.setSpeechLanguage}
          onMicToggle={session.handleMicToggle}
          onCallToggle={session.handleCallToggle}
          onClosePageDialog={session.closePageDialog}
          onSubmitPageSelection={session.submitPageSelection}
        />
      </section>
      {loadingCover}
    </main>
  );
}
