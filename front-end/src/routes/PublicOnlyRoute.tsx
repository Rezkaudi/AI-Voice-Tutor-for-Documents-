import { Navigate, Outlet } from "react-router-dom";
import { FullScreenLoader } from "@/components/common/FullScreenLoader";
import { useAuthStore } from "@/store/authStore";
import { paths } from "./paths";

export function PublicOnlyRoute() {
  const status = useAuthStore((s) => s.status);

  if (status === "loading") {
    return <FullScreenLoader label="Checking your session" />;
  }

  if (status === "authenticated") {
    return <Navigate to={paths.library} replace />;
  }

  return <Outlet />;
}
