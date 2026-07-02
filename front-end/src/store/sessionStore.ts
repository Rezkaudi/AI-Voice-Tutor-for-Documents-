import { create } from "zustand";
import { createUiSlice } from "./session/uiSlice";
import { createCallSlice } from "./session/callSlice";
import { createDocumentSessionSlice } from "./session/documentSlice";
import type { SessionStore } from "./session/types";

export type { SessionStore } from "./session/types";

export const useSessionStore = create<SessionStore>()((...a) => ({
  ...createUiSlice(...a),
  ...createCallSlice(...a),
  ...createDocumentSessionSlice(...a)
}));
