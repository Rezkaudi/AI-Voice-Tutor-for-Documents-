import { useEffect } from "react";
import { useDocumentStore } from "@/store/documentStore";
import { useSessionStore } from "@/store/sessionStore";
import { useVoiceStore } from "@/store/voiceStore";
import { AppHeader } from "./AppHeader";
import { TeachingWorkspace } from "./TeachingWorkspace";
import { UploadView } from "./UploadView";

/**
 * Root of the voice tutor workspace. Bootstraps the stores once, then routes
 * between the upload landing view and the teaching workspace. All cross-cutting
 * orchestration lives in the session store — this component only routes.
 */
export function TeachingApp() {
  // One-time bootstrap: probe microphone support, saved settings, and library.
  useEffect(() => {
    useVoiceStore.getState().init();
    useSessionStore.getState().initSaveCost();
    void useDocumentStore.getState().initLibrary();
  }, []);

  const loadedDocument = useDocumentStore((s) => s.loadedDocument);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader />
      {loadedDocument ? <TeachingWorkspace /> : <UploadView />}
    </div>
  );
}
