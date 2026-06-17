import { BookOpen } from "lucide-react";
import { useDocumentStore } from "@/store/documentStore";
import { useSessionStore } from "@/store/sessionStore";
import { useAuthStore } from "@/store/authStore";
import { LibraryMenu } from "./LibraryMenu";
import { UserMenu } from "./UserMenu";

/** Top bar: product title, the loaded document's name, and the library menu. */
export function AppHeader() {
  const loadedDocument = useDocumentStore((s) => s.loadedDocument);
  const uploadState = useDocumentStore((s) => s.uploadState);
  const library = useDocumentStore((s) => s.library);
  const libraryLoading = useDocumentStore((s) => s.libraryLoading);
  const deletingId = useDocumentStore((s) => s.deletingId);

  const user = useAuthStore((s) => s.user);
  const uploadError = useDocumentStore((s) => s.uploadError);

  const session = useSessionStore.getState();
  const documentStore = useDocumentStore.getState();

  return (
    <header className="flex min-h-16 items-center justify-between gap-3 border-b border-line bg-[oklch(0.985_0.009_86/0.92)] px-[clamp(12px,3vw,34px)] py-2.5 sm:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid h-[38px] w-[38px] flex-none place-items-center rounded-lg bg-teacher text-paper-strong">
          <BookOpen size={21} aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[clamp(0.95rem,1.6vw,1.2rem)] font-[760] leading-[1.15]">
            AI Voice Tutor for Documents
          </h1>
          <p className="mb-0 mt-[3px] truncate text-[0.82rem] text-muted">
            {loadedDocument ? loadedDocument.document.title : "Document learning board"}
          </p>
        </div>
      </div>
      <div className="flex flex-none items-center justify-end gap-2">
        <LibraryMenu
          library={library}
          libraryLoading={libraryLoading}
          activeId={loadedDocument?.document.id ?? null}
          uploadState={uploadState}
          deletingId={deletingId}
          error={uploadError}
          onSelect={session.handleSwitchDocument}
          onFile={session.handleUpload}
          onDelete={documentStore.deleteDocument}
        />
        {user && <UserMenu user={user} />}
      </div>
    </header>
  );
}
