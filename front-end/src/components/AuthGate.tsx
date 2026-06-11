import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { LoginView } from "./LoginView";

export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    void useAuthStore.getState().init();
  }, []);

  if (status === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper text-muted">
        <Loader2 className="animate-spin-fast" size={28} aria-label="Loading" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginView />;
  }

  return <>{children}</>;
}
