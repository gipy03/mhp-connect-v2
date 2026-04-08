import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
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
import DirectoryPage from "@/pages/DirectoryPage";
import DirectoryDetailPage from "@/pages/DirectoryDetailPage";
import AgendaPage from "@/pages/AgendaPage";
import Trainings from "@/pages/Trainings";
import Community from "@/pages/Community";
import Supervision from "@/pages/Supervision";
import Offers from "@/pages/Offers";
import NotFound from "@/pages/NotFound";
import AdminPrograms from "@/pages/admin/AdminPrograms";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminEnrollments from "@/pages/admin/AdminEnrollments";
import AdminRefunds from "@/pages/admin/AdminRefunds";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AdminSync from "@/pages/admin/AdminSync";
import AdminActivity from "@/pages/admin/AdminActivity";

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
// Browse layout — public pages, no auth required
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

const annuaireRoute = createRoute({
  getParentRoute: () => browseLayoutRoute,
  path: "/annuaire",
  component: DirectoryPage,
});

const annuaireDetailRoute = createRoute({
  getParentRoute: () => browseLayoutRoute,
  path: "/annuaire/$userId",
  component: DirectoryDetailPage,
});

const agendaPublicRoute = createRoute({
  getParentRoute: () => browseLayoutRoute,
  path: "/agenda",
  component: AgendaPage,
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

const profileRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/profile",
  component: Profile,
});

const notificationsRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/notifications",
  component: () => (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
      <p className="text-sm text-muted-foreground">Cette page arrive bientôt.</p>
    </div>
  ),
});

const agendaRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/agenda",
  component: AgendaPage,
});

const trainingsRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/trainings",
  component: Trainings,
});

const communityRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/community",
  component: Community,
});

const directoryRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/annuaire",
  component: DirectoryPage,
});

const directoryDetailRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/annuaire/$userId",
  component: DirectoryDetailPage,
});

const supervisionRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/supervision",
  component: Supervision,
});

const offersRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/offers",
  component: Offers,
});

// ---------------------------------------------------------------------------
// Admin layout
// ---------------------------------------------------------------------------

const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin",
  component: AdminLayout,
});

const adminRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin",
  beforeLoad: () => {
    throw redirect({ to: "/user/admin/programs" });
  },
  component: () => null,
});

const adminProgramsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/user/admin/programs",
  component: AdminPrograms,
});

const adminUsersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/user/admin/users",
  component: AdminUsers,
});

const adminEnrollmentsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/user/admin/enrollments",
  component: AdminEnrollments,
});

const adminRefundsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/user/admin/refunds",
  component: AdminRefunds,
});

const adminNotificationsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/user/admin/notifications",
  component: AdminNotifications,
});

const adminSyncRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/user/admin/sync",
  component: AdminSync,
});

const adminActivityRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/user/admin/activity",
  component: AdminActivity,
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
  browseLayoutRoute.addChildren([
    catalogueRoute,
    catalogueDetailRoute,
    annuaireRoute,
    annuaireDetailRoute,
    agendaPublicRoute,
  ]),
  memberLayoutRoute.addChildren([
    dashboardRoute,
    profileRoute,
    notificationsRoute,
    agendaRoute,
    trainingsRoute,
    communityRoute,
    directoryRoute,
    directoryDetailRoute,
    supervisionRoute,
    offersRoute,
  ]),
  adminLayoutRoute.addChildren([
    adminRoute,
    adminProgramsRoute,
    adminUsersRoute,
    adminEnrollmentsRoute,
    adminRefundsRoute,
    adminNotificationsRoute,
    adminSyncRoute,
    adminActivityRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
