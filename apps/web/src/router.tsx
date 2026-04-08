import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

import { PublicLayout } from "@/layouts/PublicLayout";
import { BrowseLayout } from "@/layouts/BrowseLayout";
import { MemberLayout } from "@/layouts/MemberLayout";
import { AdminLayout } from "@/layouts/AdminLayout";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import SetPassword from "@/pages/SetPassword";
import Dashboard from "@/pages/Dashboard";
import Catalogue from "@/pages/Catalogue";
import ProgramDetail from "@/pages/ProgramDetail";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});

// ---------------------------------------------------------------------------
// Public layout — unauthenticated, centered card
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Browse layout — public catalogue, no auth required
// ---------------------------------------------------------------------------

const browseLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "browse",
  component: BrowseLayout,
});

const catalogueRoute = createRoute({
  getParentRoute: () => browseLayoutRoute,
  path: "/catalogue",
  component: Catalogue,
});

const catalogueDetailRoute = createRoute({
  getParentRoute: () => browseLayoutRoute,
  path: "/catalogue/$code",
  component: ProgramDetail,
});

// ---------------------------------------------------------------------------
// Member layout — authenticated, sidebar + header
// ---------------------------------------------------------------------------

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

// Placeholder pages — replace with real implementations when built
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
  component: Profile,
});

const notificationsRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/notifications",
  component: () => <Placeholder title="Notifications" />,
});

const calendarRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/calendar",
  component: () => <Placeholder title="Calendrier" />,
});

const myEnrollmentsRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/my-enrollments",
  component: () => <Placeholder title="Mes inscriptions" />,
});

const communityRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/community",
  component: () => <Placeholder title="Communauté" />,
});

const directoryRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/directory",
  component: () => <Placeholder title="Annuaire" />,
});

const supervisionRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/supervision",
  component: () => <Placeholder title="Supervision" />,
});

const offersRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/offers",
  component: () => <Placeholder title="Offres" />,
});

// ---------------------------------------------------------------------------
// Admin layout — admin guard, extends member chrome
// ---------------------------------------------------------------------------

const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin",
  component: AdminLayout,
});

const adminRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin",
  component: () => (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">Administration</h1>
      <p className="text-sm text-muted-foreground">Les outils admin arriveront ici.</p>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  publicLayoutRoute.addChildren([
    loginRoute,
    registerRoute,
    forgotPasswordRoute,
    resetPasswordRoute,
    setPasswordRoute,
  ]),
  browseLayoutRoute.addChildren([catalogueRoute, catalogueDetailRoute]),
  memberLayoutRoute.addChildren([
    dashboardRoute,
    profileRoute,
    notificationsRoute,
    calendarRoute,
    myEnrollmentsRoute,
    communityRoute,
    directoryRoute,
    supervisionRoute,
    offersRoute,
  ]),
  adminLayoutRoute.addChildren([adminRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
