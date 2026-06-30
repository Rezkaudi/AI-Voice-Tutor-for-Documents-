import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/routes/router";
import { useAuthStore } from "@/store/authStore";
import { useDirection } from "@/hooks/i18n/useDirection";

export function App() {
  useDirection();

  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  return <RouterProvider router={router} />;
}
