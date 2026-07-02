import type { StateCreator } from "zustand";
import { useChatStore } from "../chatStore";
import { useDocumentStore } from "../documentStore";
import { haltCall } from "./teardown";
import type { DocumentSessionSlice, SessionStore } from "./types";

export const createDocumentSessionSlice: StateCreator<
  SessionStore,
  [],
  [],
  DocumentSessionSlice
> = (set, get) => ({
  clearChat: () => {
    useChatStore.getState().resetMessages();
    useDocumentStore.getState().applyReference(null);
    set({ hasIntroduced: false, error: null, pendingQuestion: null });
    haltCall(set, get);
  },

  handleUpload: async (file) => {
    useChatStore.getState().resetMessages();
    set({ selectedPages: [1], pageDialogOpen: false });
    return useDocumentStore.getState().uploadFile(file);
  },

  handleSwitchDocument: async (documentId) => {
    const docs = useDocumentStore.getState();
    if (docs.loadedDocument?.document.id === documentId) {
      return;
    }
    useChatStore.getState().resetMessages();
    haltCall(set, get);
    set({
      hasIntroduced: false,
      selectedPages: [1],
      pageDialogOpen: false,
      pendingQuestion: null
    });
    await docs.selectDocument(documentId);
  },

  closeDocument: () => {
    useChatStore.getState().resetMessages();
    haltCall(set, get);
    set({
      hasIntroduced: false,
      selectedPages: [1],
      pageDialogOpen: false,
      error: null,
      pendingQuestion: null
    });
    useDocumentStore.getState().closeDocument();
  }
});
