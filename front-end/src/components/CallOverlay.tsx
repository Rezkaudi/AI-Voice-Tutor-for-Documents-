import { useState } from "react";
import type { ChatMessage, SpeechCaption } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { ControlDock } from "./ControlDock";
import { FloatingTutor } from "./FloatingTutor";
import { MicPermissionDialog } from "./MicPermissionDialog";
import { PageSelectionDialog } from "./PageSelectionDialog";
import { SecondaryControls } from "./SecondaryControls";
import { TranscriptDrawer } from "./TranscriptDrawer";
import { CaptionStrip } from "./TeacherPanel/CaptionStrip";
import { MicStatusBanner } from "./TeacherPanel/MicStatusBanner";
import { deriveOrbState } from "./TeacherPanel/status";
import { useMicDialog } from "./TeacherPanel/useMicDialog";

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
  onMicToggle,
  onCallToggle,
  onClearChat,
  onEditPages,
  onToggleTranscript,
  onToggleCaption,
  onClosePageDialog,
  onSubmitPageSelection
}: CallOverlayProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const micDialog = useMicDialog(micBlocked);

  const status = { isStreaming, isSpeaking, isListening, isTranscribing, callMode };
  const orbState = deriveOrbState(status);
  const hasMessages = messages.length > 0;

  const handleMicClick = () => {
    if (micBlocked) {
      micDialog.setOpen(true);
      return;
    }
    onMicToggle();
  };

  const handleClearClick = () => {
    if (!hasMessages && !callMode) {
      onClearChat();
    } else {
      setConfirmOpen(true);
    }
  };

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

        <ControlDock
          callMode={callMode}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isStreaming={isStreaming}
          isTranscribing={isTranscribing}
          micSupported={micSupported}
          micBlocked={micBlocked}
          onCallToggle={onCallToggle}
          onMicClick={handleMicClick}
        />
      </div>

      <SecondaryControls
        showCaption={showCaption}
        showTranscript={showTranscript}
        clearDisabled={!hasMessages && !callMode}
        onEditPages={onEditPages}
        onToggleCaption={onToggleCaption}
        onToggleTranscript={onToggleTranscript}
        onClear={handleClearClick}
      />

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

      <ConfirmDialog
        open={confirmOpen}
        title="Restart the lesson?"
        body="This clears the current chat and starts a fresh session from the beginning. This action cannot be undone."
        confirmLabel="Clear & restart"
        cancelLabel="Cancel"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onClearChat();
        }}
      />
    </>
  );
}
