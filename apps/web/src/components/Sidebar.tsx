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
  FolderOpen,
  MessageSquare,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMobileSidebar } from "@/hooks/useMobileSidebar";
import { useMessagesUnreadCount } from "@/hooks/useMessaging";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  {
    title: "Mes factures",
    href: "/user/invoices",
    icon: Receipt,
    featureKey: null,
  },
];

const FEATURE_NAV: NavItem[] = [
  {
    title: "Ressources",
    href: "/user/resources",
    icon: FolderOpen,
    featureKey: null,
  },
  {
    title: "Communauté",
    href: "/user/community",
    icon: Users,
    featureKey: "community",
    lockMessage: "Disponible après une formation MHP complétée.",
  },
  {
    title: "Messages",
    href: "/user/messages",
    icon: MessageSquare,
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
      {children}
    </p>
  );
}

function NavItemRow({ item, onNavigate, badge }: { item: NavItem; onNavigate?: () => void; badge?: number }) {
  const { hasFeature } = useAuth();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const locked = item.featureKey !== null && !hasFeature(item.featureKey);
  const active = currentPath === item.href || currentPath.startsWith(item.href + "/");

  const inner = (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 select-none",
        locked
          ? "text-muted-foreground cursor-default"
          : active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
      )}
    >
      {active && !locked && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary transition-all" />
      )}
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active && !locked ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span className="flex-1 truncate">{item.title}</span>
      {badge != null && badge > 0 && !locked && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {locked && (
        <Lock className="h-3 w-3 text-muted-foreground/50" />
      )}
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

  return (
    <Link to={item.href} onClick={onNavigate} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
      {inner}
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { isAuthenticated, hasFeature } = useAuth();
  const hasCommunity = isAuthenticated && hasFeature("community");
  const { data: unreadData } = useMessagesUnreadCount(hasCommunity);
  const messagesUnread = hasCommunity ? (unreadData?.count ?? 0) : 0;

  return (
    <>
      <div className="flex h-14 items-center px-4 border-b shrink-0"
           style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-sm tracking-tight" onClick={onNavigate}>
          <span className="text-primary font-bold">mhp</span>
          <span className="text-muted-foreground font-light">|</span>
          <span className="text-foreground">connect</span>
        </Link>
      </div>

      <div className="px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs font-medium text-primary">Espace membre</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <nav aria-label="Navigation principale" className="px-3 py-2 space-y-0.5">
          <SectionLabel>Espace membre</SectionLabel>
          {MEMBER_NAV.map((item) => (
            <NavItemRow key={item.href} item={item} onNavigate={onNavigate} />
          ))}

          <div className="my-3" />
          <SectionLabel>Praticien</SectionLabel>
          {FEATURE_NAV.map((item) => (
            <NavItemRow
              key={item.href}
              item={item}
              onNavigate={onNavigate}
              badge={item.href === "/user/messages" ? messagesUnread : undefined}
            />
          ))}
        </nav>
      </ScrollArea>

      <div className="px-4 py-3 border-t shrink-0"
           style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <p className="text-[11px] text-muted-foreground/50 tabular-nums">
          v2.0
        </p>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside
      className="hidden md:flex h-screen w-[var(--sidebar-width)] shrink-0 flex-col border-r"
      style={{
        background: "hsl(var(--sidebar-bg))",
        borderColor: "hsl(var(--sidebar-border))",
      }}
    >
      <SidebarNav />
    </aside>
  );
}

export function MobileSidebar() {
  const { open, setOpen } = useMobileSidebar();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="p-0 flex flex-col"
        style={{
          background: "hsl(var(--sidebar-bg))",
          borderColor: "hsl(var(--sidebar-border))",
        }}
      >
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
