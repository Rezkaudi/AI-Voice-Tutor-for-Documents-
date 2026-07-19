import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { paths } from "@/routes/paths";
import { useChatStore } from "@/store/chatStore";
import { useDocumentStore } from "@/store/documentStore";
import { startExtractionWatch, stopExtractionWatch } from "@/store/extractionStreamRunner";
import { useSessionStore } from "@/store/sessionStore";
import { useSpeechStore } from "@/store/speechStore";
import { useVoiceStore } from "@/store/voiceStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { PdfLoadProgress } from "@/hooks/pdf-viewer/usePdfDocument";

export const DESKTOP_QUERY = "(min-width: 920px)";

export function useWorkspaceState() {
  const callMode = useSessionStore((s) => s.callMode);
  const speechLanguage = useSessionStore((s) => s.speechLanguage);
  const error = useSessionStore((s) => s.error);
  const selectedPages = useSessionStore((s) => s.selectedPages);
  const pageDialogOpen = useSessionStore((s) => s.pageDialogOpen);
  const showTranscript = useSessionStore((s) => s.showTranscript);
  const showCaption = useSessionStore((s) => s.showCaption);
  const teacherAsks = useSessionStore((s) => s.teacherAsks);
  const pendingQuestion = useSessionStore((s) => s.pendingQuestion);

  const loadedDocument = useDocumentStore((s) => s.loadedDocument);
  const uploadState = useDocumentStore((s) => s.uploadState);
  const activePage = useDocumentStore((s) => s.activePage);
  const highlight = useDocumentStore((s) => s.highlight);
  const activeCitationKey = useDocumentStore((s) => s.activeCitationKey);

  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const caption = useSpeechStore((s) => s.caption);
  const isSpeaking = useSpeechStore((s) => s.isSpeaking);

  const isListening = useVoiceStore((s) => s.isListening);
  const isTranscribing = useVoiceStore((s) => s.isTranscribing);
  const micSupported = useVoiceStore((s) => s.isSupported);
  const micPermission = useVoiceStore((s) => s.permission);

  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const navigate = useNavigate();

  const documentId = loadedDocument?.document.id;
  const extraction = useDocumentStore((s) => documentId ? s.extraction[documentId] : undefined);
  const extractionDone = extraction?.done ?? false;

  useEffect(() => {
    if (!documentId || extractionDone) return;
    startExtractionWatch(documentId);
    return () => stopExtractionWatch(documentId);
  }, [documentId, extractionDone]);

  const [boardReady, setBoardReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState<PdfLoadProgress | null>(null);
  useEffect(() => {
    setBoardReady(false);
    setLoadProgress(null);
  }, [documentId]);
  const handleBoardReady = useCallback(() => setBoardReady(true), []);
  const handleLoadProgress = useCallback(
    (progress: PdfLoadProgress) => setLoadProgress(progress),
    []
  );

  const session = useSessionStore.getState();
  const documentStore = useDocumentStore.getState();

  const handleBack = useCallback(() => {
    session.closeDocument();
    navigate(paths.library);
  }, [session, navigate]);

  return {
    callMode,
    speechLanguage,
    error,
    selectedPages,
    pageDialogOpen,
    showTranscript,
    showCaption,
    teacherAsks,
    pendingQuestion,
    loadedDocument,
    activePage,
    highlight,
    activeCitationKey,
    messages,
    isStreaming,
    caption,
    isSpeaking,
    isListening,
    isTranscribing,
    micSupported,
    isDesktop,
    micBlocked: micPermission === "denied",
    restartDisabled: messages.length === 0 && !callMode,
    showLoadingCover: !boardReady || uploadState === "processing",
    loadProgress: uploadState === "processing" ? null : loadProgress,
    pageCount: loadedDocument?.document.pageCount ?? 0,
    extraction,
    handleBack,
    handleBoardReady,
    handleLoadProgress,
    session,
    documentStore
  };
}

export type WorkspaceState = ReturnType<typeof useWorkspaceState>;
