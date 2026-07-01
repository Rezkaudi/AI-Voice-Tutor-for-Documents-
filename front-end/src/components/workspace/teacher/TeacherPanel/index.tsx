import type { ChatMessage, SpeechCaption, SpeechLanguage } from "@/types";
import { MicPermissionDialog } from "../MicPermissionDialog";
import { PageSelectionDialog } from "../PageSelectionDialog";
import { TeacherAvatar } from "../TeacherAvatar";
import { SessionControlBar } from "@/components/workspace/controls/SessionControlBar";
import { CaptionStrip } from "./CaptionStrip";
import { ThinkingDots } from "./ThinkingDots";
import { MicStatusBanner } from "./MicStatusBanner";
import { TranscriptLog } from "./TranscriptLog";
import { TutorRestingState } from "../TutorRestingState";
import { deriveOrbState, deriveStatusLabelKey } from "./status";
import { useMicDialog } from "@/hooks/teacher/useMicDialog";
import { useThinkingCue } from "@/hooks/teacher/useThinkingCue";
import { useSpeechStore } from "@/store/speechStore";
import { useTranslation } from "react-i18next";

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
  showTranscript: boolean;
  showCaption: boolean;
  error: string | null;
  pageCount: number;
  selectedPages: number[];
  pageDialogOpen: boolean;
  onSpeechLanguageChange: (language: SpeechLanguage) => void;
  onMicToggle: () => void;
  onCallToggle: () => void | Promise<void>;
  onClosePageDialog: () => void;
  onSubmitPageSelection: (pages: number[]) => void;
}

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
  showTranscript,
  showCaption,
  error,
  pageCount,
  selectedPages,
  pageDialogOpen,
  onClosePageDialog,
  onSubmitPageSelection
}: TeacherPanelProps) {
  const { t } = useTranslation();
  const micDialog = useMicDialog(micBlocked);
  const isPaused = useSpeechStore((s) => s.agentPaused);
  const isPreparing = useSpeechStore((s) => s.speechPending);

  const status = { isStreaming, isSpeaking, isListening, isTranscribing, isPaused, callMode, isPreparing };
  const orbState = deriveOrbState(status);
  const statusLabel = t(deriveStatusLabelKey(status, messages.length));
  const isThinking = useThinkingCue(status);

  return (
    <div className="relative grid h-full min-h-0 w-full flex-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] place-items-center gap-[clamp(14px,2.2vh,26px)] px-3 pb-1 pt-[clamp(60px,8vh,72px)]">
      <TeacherAvatar state={orbState} />

      <div className="text-center">
        <h2 className="m-0 text-[1.15rem] font-bold tracking-[0.01em]">{t("teacher.title")}</h2>
        <p
          className="mb-0 mt-1 inline-flex items-center gap-1.5 text-[0.9rem] text-[oklch(0.82_0.02_215)]"
          role="status"
          aria-live="polite"
        >
          {statusLabel}
          {isThinking ? <ThinkingDots className="text-[oklch(0.74_0.12_230)]" /> : null}
        </p>

      </div>

      <div className="col-start-1 row-start-3 flex h-full min-h-0 w-full max-w-[520px] flex-col items-center justify-center gap-2.5">
        {error ? <TutorRestingState variant="panel" /> : null}

        {showTranscript ? (
          <TranscriptLog messages={messages} />
        ) : null}
      </div>

      {showCaption && caption ? <CaptionStrip caption={caption} /> : null}

      <SessionControlBar large showMenu={false} />

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
    </div>
  );
}
