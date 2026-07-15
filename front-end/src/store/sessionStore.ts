import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createUiSlice } from "./session/uiSlice";
import { createCallSlice } from "./session/callSlice";
import { createDocumentSessionSlice } from "./session/documentSlice";
import type { SessionStore } from "./session/types";

export type { SessionStore } from "./session/types";

export const useSessionStore = create<SessionStore>()(
  persist(
    (...a) => ({
      ...createUiSlice(...a),
      ...createCallSlice(...a),
      ...createDocumentSessionSlice(...a)
    }),
    {
      name: "session-ui-prefs",
      // Only remember the user's toggle choices across reloads.
      partialize: (s) => ({
        showTranscript: s.showTranscript,
        showCaption: s.showCaption,
        teacherAsks: s.teacherAsks
      })
    }
  )
);
