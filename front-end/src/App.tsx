import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/routes/router";
import { useAuthStore } from "@/store/authStore";

/**
 * Root component. Probes the session once on mount (the route guards react to
 * the resulting auth status) and hands rendering to the router.
 */
export function App() {
  useEffect(() => {
    void useAuthStore.getState().init();
  }, []);

  return <RouterProvider router={router} />;
}
