import { useNavigate } from "@tanstack/react-router";
import { Moon, Sun, LogOut, User, Bell, Menu, ShieldAlert } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { useMobileSidebar } from "@/hooks/useMobileSidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PortalSwitcher } from "@/components/PortalSwitcher";
import { toast } from "sonner";

function useDarkMode() {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const toggle = () => {
    const html = document.documentElement;
    const next = !html.classList.contains("dark");
    html.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return { isDark, toggle };
}

function notificationTitle(n: AppNotification): string {
  const d = n.mergeData;
  if (!d) return "Nouvelle notification";
  if (typeof d.programName === "string") return d.programName;
  return "Nouvelle notification";
}

function notificationSubtitle(n: AppNotification): string {
  const d = n.mergeData;
  if (!d) return "";
  if (typeof d.sessionDates === "string") return d.sessionDates;
  if (typeof d.credentialName === "string") return `Certificat : ${d.credentialName}`;
  return "";
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Il y a ${days} j`;
}

function NotificationBell() {
  const { notifications, unreadCount, markRead } = useNotifications();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground",
            "hover:bg-accent hover:text-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2"
          )}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-sm rounded-lg border bg-background text-foreground shadow-lg",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-primary font-medium">
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <ScrollArea className="max-h-72">
            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune notification
                </p>
              </div>
            ) : (
              notifications.slice(0, 8).map((n) => {
                const unread = n.status !== "read";
                return (
                  <DropdownMenu.Item
                    key={n.id}
                    className={cn(
                      "flex flex-col gap-0.5 px-3 py-2.5 cursor-pointer outline-none",
                      "hover:bg-accent transition-colors",
                      unread && "bg-muted"
                    )}
                    onSelect={() => {
                      if (unread) markRead.mutate(n.id);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          unread ? "bg-primary" : "bg-transparent"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate leading-snug">
                          {notificationTitle(n)}
                        </p>
                        {notificationSubtitle(n) && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {notificationSubtitle(n)}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                          {formatRelativeDate(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </DropdownMenu.Item>
                );
              })
            )}
          </ScrollArea>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ImpersonationBanner() {
  const { user, stopImpersonating } = useAuth();

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-1.5 text-amber-950 text-xs font-medium shrink-0">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-3.5 w-3.5" />
        <span>
          Impersonation active — connecté en tant que{" "}
          <strong>{user?.email}</strong>
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-xs bg-white/80 hover:bg-white border-amber-700/30 text-amber-950"
        onClick={() => stopImpersonating.mutate()}
        disabled={stopImpersonating.isPending}
      >
        {stopImpersonating.isPending ? "…" : "Arrêter"}
      </Button>
    </div>
  );
}

export function Header() {
  const { user, logout, impersonating } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle } = useDarkMode();
  const { toggle: toggleSidebar } = useMobileSidebar();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      navigate({ to: "/" });
    } catch {
      toast.error("Erreur lors de la déconnexion.");
    }
  };

  const initials = user ? user.email[0].toUpperCase() : "?";

  return (
    <>
    {impersonating && <ImpersonationBanner />}
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={toggleSidebar}
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold md:hidden">
          <span className="text-primary font-bold">mhp</span>
          <span className="text-muted-foreground font-light"> | </span>
          connect
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <PortalSwitcher />
        <NotificationBell />

        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={isDark ? "Mode clair" : "Mode sombre"}
          className="transition-transform hover:rotate-12"
        >
          {isDark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold",
                "ring-2 ring-ring/20 hover:ring-ring/40 transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2"
              )}
              aria-label="Menu utilisateur"
            >
              {initials}
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className={cn(
                "z-50 min-w-[180px] rounded-lg border bg-background text-foreground p-1 shadow-lg",
                "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
              )}
            >
              <div className="px-2 py-1.5 border-b mb-1">
                <p className="text-xs font-medium truncate">{user?.email}</p>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {user?.role}
                </p>
              </div>

              <DropdownMenu.Item
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent outline-none transition-colors"
                onSelect={() => navigate({ to: "/profile" })}
              >
                <User className="h-3.5 w-3.5" />
                Mon profil
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="my-1 h-px bg-border" />

              <DropdownMenu.Item
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive cursor-pointer hover:bg-destructive/10 outline-none transition-colors"
                onSelect={handleLogout}
              >
                <LogOut className="h-3.5 w-3.5" />
                Déconnexion
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
    </>
  );
}
