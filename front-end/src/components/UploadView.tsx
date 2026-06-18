import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useDocumentStore } from "@/store/documentStore";
import { useSessionStore } from "@/store/sessionStore";
import { paths } from "@/routes/paths";
import { UploadPanel } from "./UploadPanel";

/** Landing view shown before any document is loaded: the upload dropzone + library. */
export function UploadView() {
  const uploadError = useDocumentStore((s) => s.uploadError);
  const uploadState = useDocumentStore((s) => s.uploadState);
  const library = useDocumentStore((s) => s.library);
  const libraryLoading = useDocumentStore((s) => s.libraryLoading);
  const deletingId = useDocumentStore((s) => s.deletingId);

  const navigate = useNavigate();
  const session = useSessionStore.getState();
  const documentStore = useDocumentStore.getState();

  // Selecting or uploading a document is a navigation: the workspace route
  // (`/documents/:id`) loads it. Upload first, then route to the new id.
  const handleSelect = (documentId: string) => navigate(paths.document(documentId));
  const handleUpload = async (file: File | null) => {
    const documentId = await session.handleUpload(file);
    if (documentId) {
      navigate(paths.document(documentId));
    }
  };

  return (
    <main
      className="flex min-h-0 flex-1 min-w-0 overflow-hidden p-[clamp(14px,2vw,26px)] [background:linear-gradient(90deg,oklch(0.91_0.017_84)_1px,transparent_1px)_0_0/36px_36px,var(--color-panel)]"
      style={{ "--color-panel": "oklch(0.96 0.01 84)" } as CSSProperties}
    >
      <UploadPanel
        uploadState={uploadState}
        error={uploadError}
        library={library}
        libraryLoading={libraryLoading}
        deletingId={deletingId}
        onFile={handleUpload}
        onSelect={handleSelect}
        onDelete={documentStore.deleteDocument}
      />
    </main>
  );
}
