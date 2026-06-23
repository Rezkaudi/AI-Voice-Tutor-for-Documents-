import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { DOCUMENT_ROUTE, LIBRARY_ROUTE, paths } from "./paths";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicOnlyRoute } from "./PublicOnlyRoute";

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [{ path: paths.login, element: <LoginPage /> }]
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: LIBRARY_ROUTE, element: <LibraryPage /> },
      { path: DOCUMENT_ROUTE, element: <WorkspacePage /> }
    ]
  },
  { path: "*", element: <Navigate to={paths.library} replace /> }
]);
