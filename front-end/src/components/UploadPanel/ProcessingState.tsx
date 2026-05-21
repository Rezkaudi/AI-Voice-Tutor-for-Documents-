import { Loader2 } from "lucide-react";
import { cx, ui } from "@/lib/uiClasses";

export function ProcessingState({ surfaceClass }: { surfaceClass: string }) {
  return (
    <div
      className={cx(surfaceClass, "grid min-h-[330px] place-items-center gap-3 text-center")}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={ui.spin} size={42} aria-hidden />
      <h2>Preparing your document</h2>
      <p>Extracting pages, building lesson passages, and warming up the teacher.</p>
    </div>
  );
}
