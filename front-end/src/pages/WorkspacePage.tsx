import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import { FullScreenLoader } from "@/components/common/FullScreenLoader";
import { TeachingWorkspace } from "@/components/workspace/TeachingWorkspace";
import { useDocumentStore } from "@/store/documentStore";
import { useSessionStore } from "@/store/sessionStore";
import { paths } from "@/routes/paths";

export function WorkspacePage() {
  const { t } = useTranslation();
  const { documentId } = useParams<{ documentId: string }>();
  const loadedDocument = useDocumentStore((s) => s.loadedDocument);
  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;
    let active = true;
    void useSessionStore
      .getState()
      .handleSwitchDocument(documentId)
      .then(() => {
        if (!active) return;
        const current = useDocumentStore.getState().loadedDocument;
        if (current?.document.id !== documentId) {
          setFailedId(documentId);
        }
      });
    return () => {
      active = false;
    };
  }, [documentId]);

  if (failedId === documentId) {
    return <Navigate to={paths.library} replace />;
  }

  if (loadedDocument?.document.id === documentId) {
    return <TeachingWorkspace />;
  }

  return <FullScreenLoader label={t("workspace.openingDocument")} />;
}
