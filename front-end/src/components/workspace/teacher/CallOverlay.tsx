import type { ChatMessage, SpeechCaption } from "@/types";
import { SessionControlBar } from "@/components/workspace/controls/SessionControlBar";
import { FloatingTutor } from "./FloatingTutor";
import { MicPermissionDialog } from "./MicPermissionDialog";
import { PageSelectionDialog } from "./PageSelectionDialog";
import { TranscriptDrawer } from "./TranscriptDrawer";
import { TutorRestingState } from "./TutorRestingState";
import { CaptionStrip } from "./TeacherPanel/CaptionStrip";
import { MicStatusBanner } from "./TeacherPanel/MicStatusBanner";
import { deriveOrbState } from "./TeacherPanel/status";
import { useMicDialog } from "@/hooks/teacher/useMicDialog";
import { useThinkingCue } from "@/hooks/teacher/useThinkingCue";
import { useSpeechStore } from "@/store/speechStore";

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
  const isPaused = useSpeechStore((s) => s.agentPaused);

  const orbState = deriveOrbState({
    isStreaming,
    isSpeaking,
    isListening,
    isTranscribing,
    isPaused,
    callMode
  });

  const isThinking = useThinkingCue({
    isStreaming,
    isSpeaking,
    isListening,
    isTranscribing,
    isPaused,
    callMode
  });

  return (
    <>
      <FloatingTutor state={orbState} thinking={isThinking} />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {error ? <TutorRestingState variant="overlay" /> : null}

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
