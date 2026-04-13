import { lazy, Suspense } from "react";
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
import { TrainerLayout } from "@/layouts/TrainerLayout";

const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const SetPassword = lazy(() => import("@/pages/SetPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Catalogue = lazy(() => import("@/pages/Catalogue"));
const ProgramDetail = lazy(() => import("@/pages/ProgramDetail"));
const Profile = lazy(() => import("@/pages/Profile"));
const DirectoryPage = lazy(() => import("@/pages/DirectoryPage"));
const DirectoryDetailPage = lazy(() => import("@/pages/DirectoryDetailPage"));
const AgendaPage = lazy(() => import("@/pages/AgendaPage"));
const Trainings = lazy(() => import("@/pages/Trainings"));
const Community = lazy(() => import("@/pages/Community"));
const Supervision = lazy(() => import("@/pages/Supervision"));
const Offers = lazy(() => import("@/pages/Offers"));
const Messages = lazy(() => import("@/pages/Messages"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const AdminPrograms = lazy(() => import("@/pages/admin/AdminPrograms"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminEnrollments = lazy(() => import("@/pages/admin/AdminEnrollments"));
const AdminRefunds = lazy(() => import("@/pages/admin/AdminRefunds"));
const AdminNotifications = lazy(() => import("@/pages/admin/AdminNotifications"));
const AdminSync = lazy(() => import("@/pages/admin/AdminSync"));
const AdminActivity = lazy(() => import("@/pages/admin/AdminActivity"));
const AdminChannels = lazy(() => import("@/pages/admin/AdminChannels"));
const AdminOffers = lazy(() => import("@/pages/admin/AdminOffers"));
const AdminEvents = lazy(() => import("@/pages/admin/AdminEvents"));
const AdminSessions = lazy(() => import("@/pages/admin/AdminSessions"));
const AdminFiles = lazy(() => import("@/pages/admin/AdminFiles"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const Resources = lazy(() => import("@/pages/Resources"));
const MesFactures = lazy(() => import("@/pages/MesFactures"));
const AdminInvoices = lazy(() => import("@/pages/admin/AdminInvoices"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminAdmins = lazy(() => import("@/pages/admin/AdminAdmins"));
const AdminInstructors = lazy(() => import("@/pages/admin/AdminInstructors"));
const TrainerDashboard = lazy(() => import("@/pages/TrainerDashboard"));
const TrainerProfilePage = lazy(() => import("@/pages/trainer/TrainerProfile"));
const TrainerSessionsPage = lazy(() => import("@/pages/trainer/TrainerSessions"));
const TrainerParticipantsPage = lazy(() => import("@/pages/trainer/TrainerParticipants"));
const TrainerAgendaPage = lazy(() => import("@/pages/trainer/TrainerAgenda"));
const TrainerFilesPage = lazy(() => import("@/pages/trainer/TrainerFiles"));

function PageSpinner() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
    </div>
  );
}

function ErrorFallback({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-xl border bg-card p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="h-6 w-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          Une erreur est survenue
        </h1>
        <p className="text-sm text-muted-foreground">
          Quelque chose s'est mal passé lors du chargement de cette page.
          Veuillez réessayer ou contacter le support si le problème persiste.
        </p>
        {import.meta.env.DEV && error?.message && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground font-mono break-all">
            {error.message}
          </p>
        )}
        <button
          onClick={reset ?? (() => window.location.reload())}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          Recharger
        </button>
      </div>
    </div>
  );
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSpinner />}>{children}</Suspense>;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <SuspenseWrapper>
      <NotFound />
    </SuspenseWrapper>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorFallback error={error as Error} reset={reset} />
  ),
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
  component: () => (
    <SuspenseWrapper>
      <Login />
    </SuspenseWrapper>
  ),
});

const registerRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/register",
  component: () => (
    <SuspenseWrapper>
      <Register />
    </SuspenseWrapper>
  ),
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/forgot-password",
  component: () => (
    <SuspenseWrapper>
      <ForgotPassword />
    </SuspenseWrapper>
  ),
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/reset-password",
  component: () => (
    <SuspenseWrapper>
      <ResetPassword />
    </SuspenseWrapper>
  ),
});

const setPasswordRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/set-password",
  component: () => (
    <SuspenseWrapper>
      <SetPassword />
    </SuspenseWrapper>
  ),
});

const adminLoginRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/admin-login",
  component: () => (
    <SuspenseWrapper>
      <AdminLogin />
    </SuspenseWrapper>
  ),
});

// ---------------------------------------------------------------------------
// Browse layout — public pages, no auth required
// ---------------------------------------------------------------------------

const browseLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "browse",
  component: BrowseLayout,
});

interface CatalogueSearch {
  q?: string;
  category?: string;
  sort?: string;
  view?: "grid" | "list";
  priceMin?: number;
  priceMax?: number;
  duration?: string;
  availability?: string;
  modality?: string;
  tags?: string;
  favoris?: boolean;
}

const catalogueRoute = createRoute({
  getParentRoute: () => browseLayoutRoute,
  path: "/catalogue",
  validateSearch: (search: Record<string, unknown>): CatalogueSearch => {
    const result: CatalogueSearch = {};
    if (search.q) result.q = String(search.q);
    if (search.category) result.category = String(search.category);
    if (search.sort) result.sort = String(search.sort);
    if (search.view === "grid" || search.view === "list") result.view = search.view;
    if (search.priceMin != null) {
      const n = Number(search.priceMin);
      if (Number.isFinite(n) && n >= 0) result.priceMin = n;
    }
    if (search.priceMax != null) {
      const n = Number(search.priceMax);
      if (Number.isFinite(n) && n >= 0) result.priceMax = n;
    }
    if (search.duration) result.duration = String(search.duration);
    if (search.availability) result.availability = String(search.availability);
    if (search.modality) result.modality = String(search.modality);
    if (search.tags) result.tags = String(search.tags);
    if (search.favoris === true || search.favoris === "true") result.favoris = true;
    return result;
  },
  component: () => (
    <SuspenseWrapper>
      <Catalogue />
    </SuspenseWrapper>
  ),
});

interface CatalogueDetailSearch {
  enroll?: string;
  sessionId?: string;
}

const catalogueDetailRoute = createRoute({
  getParentRoute: () => browseLayoutRoute,
  path: "/catalogue/$code",
  validateSearch: (search: Record<string, unknown>): CatalogueDetailSearch => {
    const result: CatalogueDetailSearch = {};
    if (search.enroll === "true" || search.enroll === true) result.enroll = "true";
    if (search.sessionId && typeof search.sessionId === "string") result.sessionId = search.sessionId;
    return result;
  },
  component: () => (
    <SuspenseWrapper>
      <ProgramDetail />
    </SuspenseWrapper>
  ),
});

const annuaireRoute = createRoute({
  getParentRoute: () => browseLayoutRoute,
  path: "/annuaire",
  component: () => (
    <SuspenseWrapper>
      <DirectoryPage />
    </SuspenseWrapper>
  ),
});

const annuaireDetailRoute = createRoute({
  getParentRoute: () => browseLayoutRoute,
  path: "/annuaire/$userId",
  component: () => (
    <SuspenseWrapper>
      <DirectoryDetailPage />
    </SuspenseWrapper>
  ),
});

const agendaPublicRoute = createRoute({
  getParentRoute: () => browseLayoutRoute,
  path: "/agenda",
  component: () => (
    <SuspenseWrapper>
      <AgendaPage />
    </SuspenseWrapper>
  ),
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
  component: () => (
    <SuspenseWrapper>
      <Dashboard />
    </SuspenseWrapper>
  ),
});

const profileRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/profile",
  component: () => (
    <SuspenseWrapper>
      <Profile />
    </SuspenseWrapper>
  ),
});

const notificationsRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/notifications",
  component: () => (
    <SuspenseWrapper>
      <Notifications />
    </SuspenseWrapper>
  ),
});

const agendaRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/agenda",
  component: () => (
    <SuspenseWrapper>
      <AgendaPage />
    </SuspenseWrapper>
  ),
});

const trainingsRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/trainings",
  component: () => (
    <SuspenseWrapper>
      <Trainings />
    </SuspenseWrapper>
  ),
});

const communityRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/community",
  component: () => (
    <SuspenseWrapper>
      <Community />
    </SuspenseWrapper>
  ),
});

const directoryRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/annuaire",
  component: () => (
    <SuspenseWrapper>
      <DirectoryPage />
    </SuspenseWrapper>
  ),
});

const directoryDetailRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/annuaire/$userId",
  component: () => (
    <SuspenseWrapper>
      <DirectoryDetailPage />
    </SuspenseWrapper>
  ),
});

const resourcesRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/resources",
  component: () => (
    <SuspenseWrapper>
      <Resources />
    </SuspenseWrapper>
  ),
});

const supervisionRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/supervision",
  component: () => (
    <SuspenseWrapper>
      <Supervision />
    </SuspenseWrapper>
  ),
});

const offersRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/offers",
  component: () => (
    <SuspenseWrapper>
      <Offers />
    </SuspenseWrapper>
  ),
});

const messagesRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/messages",
  component: () => (
    <SuspenseWrapper>
      <Messages />
    </SuspenseWrapper>
  ),
});

const mesFacturesRoute = createRoute({
  getParentRoute: () => memberLayoutRoute,
  path: "/user/invoices",
  component: () => (
    <SuspenseWrapper>
      <MesFactures />
    </SuspenseWrapper>
  ),
});


// ---------------------------------------------------------------------------
// Admin layout — routes under /admin/*
// ---------------------------------------------------------------------------

const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin",
  component: AdminLayout,
});

const adminIndexRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin",
  component: () => (
    <SuspenseWrapper>
      <AdminDashboard />
    </SuspenseWrapper>
  ),
});

const adminProgramsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/programs",
  component: () => (
    <SuspenseWrapper>
      <AdminPrograms />
    </SuspenseWrapper>
  ),
});

const adminUsersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/users",
  component: () => (
    <SuspenseWrapper>
      <AdminUsers />
    </SuspenseWrapper>
  ),
});

const adminEnrollmentsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/enrollments",
  component: () => (
    <SuspenseWrapper>
      <AdminEnrollments />
    </SuspenseWrapper>
  ),
});

const adminRefundsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/refunds",
  component: () => (
    <SuspenseWrapper>
      <AdminRefunds />
    </SuspenseWrapper>
  ),
});

const adminNotificationsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/notifications",
  component: () => (
    <SuspenseWrapper>
      <AdminNotifications />
    </SuspenseWrapper>
  ),
});

const adminSyncRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/sync",
  component: () => (
    <SuspenseWrapper>
      <AdminSync />
    </SuspenseWrapper>
  ),
});

const adminActivityRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/activity",
  component: () => (
    <SuspenseWrapper>
      <AdminActivity />
    </SuspenseWrapper>
  ),
});

const adminChannelsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/channels",
  component: () => (
    <SuspenseWrapper>
      <AdminChannels />
    </SuspenseWrapper>
  ),
});

const adminOffersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/offers",
  component: () => (
    <SuspenseWrapper>
      <AdminOffers />
    </SuspenseWrapper>
  ),
});

const adminEventsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/events",
  component: () => (
    <SuspenseWrapper>
      <AdminEvents />
    </SuspenseWrapper>
  ),
});

const adminSessionsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/sessions",
  component: () => (
    <SuspenseWrapper>
      <AdminSessions />
    </SuspenseWrapper>
  ),
});

const adminFilesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/resources",
  component: () => (
    <SuspenseWrapper>
      <AdminFiles />
    </SuspenseWrapper>
  ),
});

const adminFilesRedirectRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/files",
  beforeLoad: () => {
    throw redirect({ to: "/admin/resources" });
  },
  component: () => null,
});

const adminInvoicesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/invoices",
  component: () => (
    <SuspenseWrapper>
      <AdminInvoices />
    </SuspenseWrapper>
  ),
});

const adminAdminsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/admins",
  component: () => (
    <SuspenseWrapper>
      <AdminAdmins />
    </SuspenseWrapper>
  ),
});

const adminInstructorsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/instructors",
  component: () => (
    <SuspenseWrapper>
      <AdminInstructors />
    </SuspenseWrapper>
  ),
});

// ---------------------------------------------------------------------------
// Legacy admin redirects — /user/admin/* -> /admin/*
// ---------------------------------------------------------------------------

const legacyAdminLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "legacy-admin",
  beforeLoad: () => {
    throw redirect({ to: "/admin/programs" });
  },
  component: () => null,
});

const legacyAdminPrograms = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/programs",
  component: () => null,
});

const legacyAdminUsers = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/users",
  component: () => null,
});

const legacyAdminEnrollments = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/enrollments",
  component: () => null,
});

const legacyAdminRefunds = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/refunds",
  component: () => null,
});

const legacyAdminNotifs = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/notifications",
  component: () => null,
});

const legacyAdminSync = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/sync",
  component: () => null,
});

const legacyAdminActivity = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/activity",
  component: () => null,
});

const legacyAdminChannels = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/channels",
  component: () => null,
});

const legacyAdminOffers = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/offers",
  component: () => null,
});

const legacyAdminEvents = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/events",
  component: () => null,
});

const legacyAdminFiles = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/resources",
  component: () => null,
});

const legacyAdminInvoices = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/invoices",
  component: () => null,
});

const legacyAdminAdmins = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/admins",
  component: () => null,
});

const legacyAdminInstructors = createRoute({
  getParentRoute: () => legacyAdminLayout,
  path: "/user/admin/instructors",
  component: () => null,
});

// ---------------------------------------------------------------------------
// Trainer layout — routes under /trainer/*
// ---------------------------------------------------------------------------

const trainerLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "trainer",
  component: TrainerLayout,
});

const trainerDashboardRoute = createRoute({
  getParentRoute: () => trainerLayoutRoute,
  path: "/trainer/dashboard",
  component: () => (
    <SuspenseWrapper>
      <TrainerDashboard />
    </SuspenseWrapper>
  ),
});

const trainerIndexRoute = createRoute({
  getParentRoute: () => trainerLayoutRoute,
  path: "/trainer",
  beforeLoad: () => {
    throw redirect({ to: "/trainer/dashboard" });
  },
  component: () => null,
});

const trainerProfileRoute = createRoute({
  getParentRoute: () => trainerLayoutRoute,
  path: "/trainer/profile",
  component: () => (
    <SuspenseWrapper>
      <TrainerProfilePage />
    </SuspenseWrapper>
  ),
});

const trainerSessionsRoute = createRoute({
  getParentRoute: () => trainerLayoutRoute,
  path: "/trainer/sessions",
  component: () => (
    <SuspenseWrapper>
      <TrainerSessionsPage />
    </SuspenseWrapper>
  ),
});

const trainerSessionDetailRoute = createRoute({
  getParentRoute: () => trainerLayoutRoute,
  path: "/trainer/sessions/$sessionId",
  component: () => {
    const { sessionId } = trainerSessionDetailRoute.useParams();
    return (
      <SuspenseWrapper>
        <TrainerParticipantsPage sessionId={sessionId} />
      </SuspenseWrapper>
    );
  },
});

const trainerAgendaRoute = createRoute({
  getParentRoute: () => trainerLayoutRoute,
  path: "/trainer/agenda",
  component: () => (
    <SuspenseWrapper>
      <TrainerAgendaPage />
    </SuspenseWrapper>
  ),
});

const trainerFilesRoute = createRoute({
  getParentRoute: () => trainerLayoutRoute,
  path: "/trainer/files",
  component: () => (
    <SuspenseWrapper>
      <TrainerFilesPage />
    </SuspenseWrapper>
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
    adminLoginRoute,
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
    resourcesRoute,
    supervisionRoute,
    offersRoute,
    messagesRoute,
    mesFacturesRoute,
  ]),
  adminLayoutRoute.addChildren([
    adminIndexRoute,
    adminProgramsRoute,
    adminUsersRoute,
    adminEnrollmentsRoute,
    adminRefundsRoute,
    adminNotificationsRoute,
    adminSyncRoute,
    adminActivityRoute,
    adminChannelsRoute,
    adminOffersRoute,
    adminEventsRoute,
    adminSessionsRoute,
    adminFilesRoute,
    adminFilesRedirectRoute,
    adminInvoicesRoute,
    adminAdminsRoute,
    adminInstructorsRoute,
  ]),
  trainerLayoutRoute.addChildren([
    trainerIndexRoute,
    trainerDashboardRoute,
    trainerProfileRoute,
    trainerSessionsRoute,
    trainerSessionDetailRoute,
    trainerAgendaRoute,
    trainerFilesRoute,
  ]),
  legacyAdminLayout.addChildren([
    legacyAdminPrograms,
    legacyAdminUsers,
    legacyAdminEnrollments,
    legacyAdminRefunds,
    legacyAdminNotifs,
    legacyAdminSync,
    legacyAdminActivity,
    legacyAdminChannels,
    legacyAdminOffers,
    legacyAdminEvents,
    legacyAdminFiles,
    legacyAdminInvoices,
    legacyAdminAdmins,
    legacyAdminInstructors,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
