import type { ChatMessage, SpeechCaption } from "@/types";
import { SessionControlBar } from "@/components/workspace/controls/SessionControlBar";
import { FloatingTutor } from "./FloatingTutor";
import { MicPermissionDialog } from "./MicPermissionDialog";
import { PageSelectionDialog } from "./PageSelectionDialog";
import { TranscriptDrawer } from "./TranscriptDrawer";
import { CaptionStrip } from "./TeacherPanel/CaptionStrip";
import { MicStatusBanner } from "./TeacherPanel/MicStatusBanner";
import { deriveOrbState } from "./TeacherPanel/status";
import { useMicDialog } from "@/hooks/teacher/useMicDialog";

interface CallOverlayProps {
  messages: ChatMessage[];
  caption: SpeechCaption | null;
  isStreaming: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  micSupported: boolean;
  micBlocked: boolean;
  callMode: boolean;
  error: string | null;
  pageCount: number;
  selectedPages: number[];
  pageDialogOpen: boolean;
  showTranscript: boolean;
  showCaption: boolean;
  onMicToggle: () => void;
  onCallToggle: () => void | Promise<void>;
  onClearChat: () => void;
  onEditPages: () => void;
  onToggleTranscript: () => void;
  onToggleCaption: () => void;
  onClosePageDialog: () => void;
  onSubmitPageSelection: (pages: number[]) => void;
}

export function CallOverlay({
  messages,
  caption,
  isStreaming,
  isSpeaking,
  isListening,
  isTranscribing,
  micSupported,
  micBlocked,
  callMode,
  error,
  pageCount,
  selectedPages,
  pageDialogOpen,
  showTranscript,
  showCaption,
  onToggleTranscript,
  onClosePageDialog,
  onSubmitPageSelection
}: CallOverlayProps) {
  const micDialog = useMicDialog(micBlocked);

  const orbState = deriveOrbState({ isStreaming, isSpeaking, isListening, isTranscribing, callMode });

  return (
    <>
      <FloatingTutor state={orbState} />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {error ? (
          <div
            className="pointer-events-auto max-w-[min(560px,92vw)] rounded-xl border border-[oklch(0.5_0.12_30)] bg-[oklch(0.28_0.07_30/0.92)] px-3.5 py-2 text-center text-[0.88rem] font-semibold text-[oklch(0.9_0.1_32)] shadow-[0_10px_28px_oklch(0.1_0.03_30/0.45)] backdrop-blur-[8px]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {(!micSupported || micBlocked) ? (
          <div className="pointer-events-auto">
            <MicStatusBanner
              micSupported={micSupported}
              micBlocked={micBlocked}
              onOpenHelp={() => micDialog.setOpen(true)}
            />
          </div>
        ) : null}

        {showCaption && caption ? (
          <div className="flex w-full justify-center">
            <CaptionStrip caption={caption} />
          </div>
        ) : null}

        <SessionControlBar />
      </div>

      <TranscriptDrawer
        open={showTranscript}
        messages={messages}
        onClose={onToggleTranscript}
      />

      <MicPermissionDialog open={micDialog.open} onClose={() => micDialog.setOpen(false)} />

      {pageDialogOpen ? (
        <PageSelectionDialog
          pageCount={pageCount}
          selectedPages={selectedPages}
          callMode={callMode}
          onConfirm={onSubmitPageSelection}
          onCancel={onClosePageDialog}
        />
      ) : null}
    </>
  );
}
