import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { useAuthStore } from "@/store/authStore";
import { useDocumentStore } from "@/store/documentStore";
import { useSessionStore } from "@/store/sessionStore";
import { useVoiceStore } from "@/store/voiceStore";
import { paths } from "./paths";

export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== "authenticated") return;
    useVoiceStore.getState().init();
    useSessionStore.getState().initSaveCost();
    void useDocumentStore.getState().initLibrary();
  }, [status]);

  if (status === "loading") {
    return <FullScreenLoader label="Checking your session" />;
  }

  if (status === "unauthenticated") {
    return <Navigate to={paths.login} replace />;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Outlet />
    </div>
  );
}
