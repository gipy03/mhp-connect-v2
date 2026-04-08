import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

import { PublicLayout } from "@/layouts/PublicLayout";
import { MemberLayout } from "@/layouts/MemberLayout";
import { AdminLayout } from "@/layouts/AdminLayout";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import SetPassword from "@/pages/SetPassword";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";

// Root route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});

// Public layout route (no auth, centered card layout)
const publicLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "public",
  component: PublicLayout,
});

const loginRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/",
  component: Login,
});

const registerRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/register",
  component: Register,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/forgot-password",
  component: ForgotPassword,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/reset-password",
  component: ResetPassword,
});

const setPasswordRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/set-password",
  component: SetPassword,
});

// Member layout route (auth guard, sidebar + header)
const memberLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "member",
  component: MemberLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/dashboard",
  component: Dashboard,
});

// Admin layout route (admin guard, extends member layout)
const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin",
  component: AdminLayout,
});

// Placeholder member pages — replace with real pages when built
function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">Cette page arrive bientôt.</p>
    </div>
  );
}

const profileRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/profile",
  component: () => <Placeholder title="Mon profil" />,
});

const notificationsRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/notifications",
  component: () => <Placeholder title="Notifications" />,
});

// Placeholder admin index — replace with real Admin page when built
function AdminPlaceholder() {
  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">Administration</h1>
      <p className="text-sm text-muted-foreground">Les outils admin arriveront ici.</p>
    </div>
  );
}

const adminRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin",
  component: AdminPlaceholder,
});

// Route tree
const routeTree = rootRoute.addChildren([
  publicLayoutRoute.addChildren([
    loginRoute,
    registerRoute,
    forgotPasswordRoute,
    resetPasswordRoute,
    setPasswordRoute,
  ]),
  memberLayoutRoute.addChildren([dashboardRoute, profileRoute, notificationsRoute]),
  adminLayoutRoute.addChildren([adminRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
