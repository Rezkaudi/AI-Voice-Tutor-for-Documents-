import { BookOpen, Captions, RotateCcw } from "lucide-react";
import { cx } from "@/lib/uiClasses";
import { cornerButton, cornerButtonActive, cornerLabel } from "./styles";

interface CornerButtonsProps {
  showTranscript: boolean;
  onToggleTranscript: () => void;
  onEditPages: () => void;
  editPagesDisabled: boolean;
  saveCost: boolean;
  onSaveCostToggle: () => void;
  saveCostDisabled: boolean;
  onClear: () => void;
  clearDisabled: boolean;
}

/** Top-bar action buttons overlaid on the avatar surface. */
export function CornerButtons({
  showTranscript,
  onToggleTranscript,
  onEditPages,
  editPagesDisabled,
  saveCost,
  onSaveCostToggle,
  saveCostDisabled,
  onClear,
  clearDisabled
}: CornerButtonsProps) {
  const transcriptLabel = showTranscript
    ? "Hide the lesson transcript"
    : "Show the lesson transcript";
  return (
    <>
      <button
        className={cx(cornerButton, "left-3", showTranscript && cornerButtonActive)}
        type="button"
        aria-pressed={showTranscript}
        aria-expanded={showTranscript}
        aria-label={transcriptLabel}
        title={transcriptLabel}
        onClick={onToggleTranscript}
      >
        <Captions size={16} aria-hidden />
        {/* <span className={cornerLabel}>{showTranscript ? "Hide" : "Transcript"}</span> */}
      </button>

      <button
        className={cx(cornerButton, "left-[60px] sm:left-[152px]")}
        type="button"
        aria-label="Choose which pages to study"
        title="Choose which pages to study"
        onClick={onEditPages}
        disabled={editPagesDisabled}
      >
        <BookOpen size={16} aria-hidden />
        <span className={cornerLabel}>Pages</span>
      </button>

      {/* <button
        className={cx(cornerButton, "right-[58px] sm:right-[76px]", saveCost && cornerButtonActive)}
        type="button"
        aria-pressed={saveCost}
        aria-label={saveCostLabel}
        title={saveCostLabel}
        onClick={onSaveCostToggle}
        disabled={saveCostDisabled}
      >
        <Leaf size={16} aria-hidden />
        <span className={cornerLabel}>Save-cost{saveCost ? " · On" : ""}</span>
      </button> */}

      <button
        className={cx(cornerButton, "right-3")}
        type="button"
        aria-label="Clear chat and restart"
        title="Clear chat and restart"
        onClick={onClear}
        disabled={clearDisabled}
      >
        <RotateCcw size={16} aria-hidden />
      </button>
    </>
  );
}
