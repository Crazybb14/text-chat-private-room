import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Index from "@/pages/Index";
import ChatRoom from "@/pages/ChatRoom";
import AdminPanel from "@/pages/AdminPanel";
import AdminBiometric from "@/pages/AdminBiometric";
import AdminLogin from "@/pages/AdminLogin";
import TermsOfUse from "@/pages/TermsOfUse";
import Suggestions from "@/pages/Suggestions";
import Appeal from "@/pages/Appeal";
import NotFound from "@/pages/NotFound";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Index />,
  },
  {
    path: "/chat/:roomId",
    element: <ChatRoom />,
  },
{
    path: "/admin/panel",
    element: <AdminPanel />,
  },
  {
    path: "/admin-panel",
    element: <AdminPanel />,
  },
  {
    path: "/panel",
    element: <AdminPanel />,
  },
  {
    path: "/admin",
    element: <AdminLogin />,
  },
  {
    path: "/admin-biometric",
    element: <AdminBiometric />,
  },
  {
    path: "/terms",
    element: <TermsOfUse />,
  },
  {
    path: "/suggestions",
    element: <Suggestions />,
  },
  {
    path: "/appeal",
    element: <Appeal />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};