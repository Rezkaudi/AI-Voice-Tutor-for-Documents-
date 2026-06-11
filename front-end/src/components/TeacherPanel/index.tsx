import { useState } from "react";
import type {
  ChatMessage,
  SpeechCaption,
  SpeechLanguage
} from "@/lib/types";
import { ConfirmDialog } from "../ConfirmDialog";
import { MicPermissionDialog } from "../MicPermissionDialog";
import { PageSelectionDialog } from "../PageSelectionDialog";
import { TeacherAvatar } from "../TeacherAvatar";
import { CallControls } from "./CallControls";
import { CaptionStrip } from "./CaptionStrip";
import { CornerButtons } from "./CornerButtons";
import { LanguagePicker } from "./LanguagePicker";
import { MicStatusBanner } from "./MicStatusBanner";
import { TranscriptLog } from "./TranscriptLog";
import { bubbleBase } from "./styles";
import { deriveOrbState, deriveStatusLabel } from "./status";
import { useMicDialog } from "./useMicDialog";
import { cx } from "@/lib/uiClasses";

interface TeacherPanelProps {
  messages: ChatMessage[];
  caption: SpeechCaption | null;
  isStreaming: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  micSupported: boolean;
  micBlocked: boolean;
  callMode: boolean;
  speechLanguage: SpeechLanguage;
  saveCost: boolean;
  error: string | null;
  pageCount: number;
  selectedPages: number[];
  pageDialogOpen: boolean;
  onSpeechLanguageChange: (language: SpeechLanguage) => void;
  onSaveCostToggle: () => void;
  onMicToggle: () => void;
  onCallToggle: () => void | Promise<void>;
  onClearChat: () => void;
  onClosePageDialog: () => void;
  onSubmitPageSelection: (pages: number[]) => void;
}

/** Avatar-led voice-call panel: transcript, language picker, and call controls. */
export function TeacherPanel({
  messages,
  caption,
  isStreaming,
  isSpeaking,
  isListening,
  isTranscribing,
  micSupported,
  micBlocked,
  callMode,
  speechLanguage,
  saveCost,
  error,
  pageCount,
  selectedPages,
  pageDialogOpen,
  onSpeechLanguageChange,
  onSaveCostToggle,
  onMicToggle,
  onCallToggle,
  onClearChat,
  onClosePageDialog,
  onSubmitPageSelection
}: TeacherPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Transcript starts hidden — the call leads with the avatar and live caption;
  // the learner opts into the full text history.
  const [showTranscript, setShowTranscript] = useState(false);
  const micDialog = useMicDialog(micBlocked);

  const status = { isStreaming, isSpeaking, isListening, isTranscribing, callMode };
  const orbState = deriveOrbState(status);
  const statusLabel = deriveStatusLabel(status, messages.length);
  const hasMessages = messages.length > 0;
  const langDisabled = isListening || isTranscribing || micBlocked;
  const saveCostDisabled = isStreaming || isListening || isTranscribing;

  // While blocked, the mic button explains the fix instead of failing silently.
  const handleMicClick = () => {
    if (micBlocked) {
      micDialog.setOpen(true);
      return;
    }
    onMicToggle();
  };

  const handleClearClick = () => {
    if (!hasMessages) {
      onClearChat();
    } else {
      setConfirmOpen(true);
    }
  };

  return (
    <div className="relative grid h-full min-h-0 w-full flex-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] place-items-center gap-[clamp(14px,2.2vh,26px)] px-3 pb-1 pt-[clamp(60px,8vh,72px)]">
      <CornerButtons
        showTranscript={showTranscript}
        onToggleTranscript={() => setShowTranscript((open) => !open)}
        saveCost={saveCost}
        onSaveCostToggle={onSaveCostToggle}
        saveCostDisabled={saveCostDisabled}
        onClear={handleClearClick}
        clearDisabled={!hasMessages && !callMode}
      />

      <TeacherAvatar state={orbState} />

      <div className="text-center">
        <h2 className="m-0 text-[1.15rem] font-bold tracking-[0.01em]">AI Teacher</h2>
        <p
          className="mb-0 mt-1 text-[0.9rem] text-[oklch(0.82_0.02_215)]"
          role="status"
          aria-live="polite"
        >
          {statusLabel}
        </p>
        {/* Language picker ("I SPEAK" + language options) hidden; default language (auto) still applies.
            Uncomment to let users see and change the spoken language. */}
        {/* <LanguagePicker
          value={speechLanguage}
          disabled={langDisabled}
          onChange={onSpeechLanguageChange}
        /> */}
      </div>

      {/* Explicit row: shares the flexible middle row with the caption strip
          overlay, so auto-placement can't bump it down when the caption shows. */}
      <div className="col-start-1 row-start-3 flex h-full min-h-0 w-full max-w-[520px] flex-col items-center justify-center gap-2.5">
        {error ? (
          <div
            className={cx(
              bubbleBase,
              "self-start rounded-bl bg-[oklch(0.31_0.07_30)] font-semibold text-[oklch(0.86_0.1_32)] border border-[oklch(0.5_0.12_30)]"
            )}
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {showTranscript ? (
          <TranscriptLog messages={messages} />
        ) : null}
      </div>

      {caption ? <CaptionStrip caption={caption} /> : null}

      <CallControls
        callMode={callMode}
        isListening={isListening}
        isStreaming={isStreaming}
        isTranscribing={isTranscribing}
        micSupported={micSupported}
        micBlocked={micBlocked}
        onCallToggle={onCallToggle}
        onMicClick={handleMicClick}
      />

      <MicStatusBanner
        micSupported={micSupported}
        micBlocked={micBlocked}
        onOpenHelp={() => micDialog.setOpen(true)}
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
    </div>
  );
}
