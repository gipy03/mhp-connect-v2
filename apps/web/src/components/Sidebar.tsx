import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  User,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Users,
  MapPin,
  GraduationCap,
  Briefcase,
  Lock,
  ChevronRight,
  BookMarked,
  UserCog,
  RotateCcw,
  Bell,
  RefreshCw,
  ActivitySquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Nav item definitions
// ---------------------------------------------------------------------------

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  featureKey: string | null;
  lockMessage?: string;
}

const MEMBER_NAV: NavItem[] = [
  {
    title: "Tableau de bord",
    href: "/dashboard",
    icon: LayoutDashboard,
    featureKey: null,
  },
  {
    title: "Mon profil",
    href: "/profile",
    icon: User,
    featureKey: null,
  },
  {
    title: "Catalogue",
    href: "/catalogue",
    icon: BookOpen,
    featureKey: null,
  },
  {
    title: "Agenda",
    href: "/user/agenda",
    icon: CalendarDays,
    featureKey: null,
  },
  {
    title: "Mes formations",
    href: "/user/trainings",
    icon: ClipboardList,
    featureKey: null,
  },
];

const FEATURE_NAV: NavItem[] = [
  {
    title: "Communauté",
    href: "/user/community",
    icon: Users,
    featureKey: "community",
    lockMessage: "Disponible après une formation MHP complétée.",
  },
  {
    title: "Annuaire",
    href: "/user/annuaire",
    icon: MapPin,
    featureKey: "directory",
    lockMessage: "Nécessite la certification OMNI Praticien.",
  },
  {
    title: "Supervision",
    href: "/user/supervision",
    icon: GraduationCap,
    featureKey: "supervision",
    lockMessage: "Nécessite la certification OMNI Praticien.",
  },
  {
    title: "Offres",
    href: "/user/offers",
    icon: Briefcase,
    featureKey: "offers",
    lockMessage: "Nécessite la certification OMNI Praticien.",
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    title: "Programmes",
    href: "/user/admin/programs",
    icon: BookMarked,
    featureKey: null,
  },
  {
    title: "Utilisateurs",
    href: "/user/admin/users",
    icon: UserCog,
    featureKey: null,
  },
  {
    title: "Remboursements",
    href: "/user/admin/refunds",
    icon: RotateCcw,
    featureKey: null,
  },
  {
    title: "Notifications",
    href: "/user/admin/notifications",
    icon: Bell,
    featureKey: null,
  },
  {
    title: "Sync & Statut",
    href: "/user/admin/sync",
    icon: RefreshCw,
    featureKey: null,
  },
  {
    title: "Activité",
    href: "/user/admin/activity",
    icon: ActivitySquare,
    featureKey: null,
  },
];

// ---------------------------------------------------------------------------
// Single nav item
// ---------------------------------------------------------------------------

function NavItemRow({ item }: { item: NavItem }) {
  const { hasFeature } = useAuth();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const locked = item.featureKey !== null && !hasFeature(item.featureKey);
  const active = currentPath === item.href || currentPath.startsWith(item.href + "/");

  const inner = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors select-none",
        locked
          ? "text-muted-foreground cursor-default"
          : active
          ? "bg-primary/8 text-foreground font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
      )}
    >
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0",
          active && !locked ? "text-foreground" : "text-muted-foreground"
        )}
      />
      <span className="flex-1 truncate">{item.title}</span>
      {locked ? (
        <Lock className="h-3 w-3 text-muted-foreground/50" />
      ) : active ? (
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
      ) : null}
    </div>
  );

  if (locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{inner}</div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          {item.lockMessage ?? "Fonctionnalité non disponible."}
        </TooltipContent>
      </Tooltip>
    );
  }

  return <Link to={item.href}>{inner}</Link>;
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar() {
  const { isAdmin } = useAuth();

  return (
    <aside
      className="flex h-screen w-[var(--sidebar-width)] shrink-0 flex-col border-r"
      style={{
        background: "hsl(var(--sidebar-bg))",
        borderColor: "hsl(var(--sidebar-border))",
      }}
    >
      {/* Branding */}
      <div className="flex h-14 items-center px-4 border-b shrink-0"
           style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-sm tracking-tight">
          <span className="text-foreground">mhp</span>
          <span className="text-muted-foreground font-light">|</span>
          <span className="text-foreground">connect</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {/* Always-visible items */}
        {MEMBER_NAV.map((item) => (
          <NavItemRow key={item.href} item={item} />
        ))}

        <Separator className="my-3" />

        {/* Feature-gated items */}
        {FEATURE_NAV.map((item) => (
          <NavItemRow key={item.href} item={item} />
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <Separator className="my-3" />
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Administration
            </p>
            {ADMIN_NAV.map((item) => (
              <NavItemRow key={item.href} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* Footer version badge */}
      <div className="px-4 py-3 border-t shrink-0"
           style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <p className="text-[11px] text-muted-foreground/50 tabular-nums">
          v2.0
        </p>
      </div>
    </aside>
  );
}
