import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookMarked,
  UserCog,
  ScrollText,
  RotateCcw,
  Bell,
  RefreshCw,
  ActivitySquare,
  Hash,
  Briefcase,
  PartyPopper,
  FileText,
  Receipt,
  Shield,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileSidebar } from "@/hooks/useMobileSidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_NAV: NavItem[] = [
  { title: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { title: "Programmes", href: "/admin/programs", icon: BookMarked },
  { title: "Utilisateurs", href: "/admin/users", icon: UserCog },
  { title: "Inscriptions", href: "/admin/enrollments", icon: ScrollText },
  { title: "Remboursements", href: "/admin/refunds", icon: RotateCcw },
  { title: "Notifications", href: "/admin/notifications", icon: Bell },
  { title: "Sync & Statut", href: "/admin/sync", icon: RefreshCw },
  { title: "Activité", href: "/admin/activity", icon: ActivitySquare },
  { title: "Canaux forum", href: "/admin/channels", icon: Hash },
  { title: "Offres", href: "/admin/offers", icon: Briefcase },
  { title: "Événements", href: "/admin/events", icon: PartyPopper },
  { title: "Ressources", href: "/admin/resources", icon: FileText },
  { title: "Factures", href: "/admin/invoices", icon: Receipt },
  { title: "Formateurs", href: "/admin/instructors", icon: GraduationCap },
  { title: "Administrateurs", href: "/admin/admins", icon: Shield },
];

function NavItemRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const active = item.href === "/admin"
    ? currentPath === "/admin" || currentPath === "/admin/"
    : currentPath === item.href || currentPath.startsWith(item.href + "/");

  return (
    <Link to={item.href} onClick={onNavigate} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 select-none",
          active
            ? "bg-[hsl(82,40%,35%)]/10 text-[hsl(82,40%,35%)] font-medium"
            : "text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[hsl(82,40%,35%)] transition-all" />
        )}
        <item.icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            active ? "text-[hsl(82,40%,35%)]" : "text-muted-foreground"
          )}
        />
        <span className="flex-1 truncate">{item.title}</span>
      </div>
    </Link>
  );
}

function AdminSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-14 items-center px-4 border-b shrink-0"
           style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <Link to="/admin" className="flex items-center gap-2 font-semibold text-sm tracking-tight" onClick={onNavigate}>
          <span className="text-[hsl(82,40%,35%)] font-bold">mhp</span>
          <span className="text-muted-foreground font-light">|</span>
          <span className="text-foreground">admin</span>
        </Link>
      </div>

      <div className="px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 rounded-md bg-[hsl(82,40%,35%)]/10 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-[hsl(82,40%,35%)]" />
          <span className="text-xs font-medium text-[hsl(82,40%,35%)]">Administration</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <nav aria-label="Navigation administration" className="px-3 py-2 space-y-0.5">
          {ADMIN_NAV.map((item) => (
            <NavItemRow key={item.href} item={item} onNavigate={onNavigate} />
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

export function AdminSidebar() {
  return (
    <aside
      className="hidden md:flex h-screen w-[var(--sidebar-width)] shrink-0 flex-col border-r"
      style={{
        background: "hsl(var(--sidebar-bg))",
        borderColor: "hsl(var(--sidebar-border))",
      }}
    >
      <AdminSidebarNav />
    </aside>
  );
}

export function AdminMobileSidebar() {
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
        <AdminSidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
