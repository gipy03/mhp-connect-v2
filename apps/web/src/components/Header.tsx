import { useNavigate } from "@tanstack/react-router";
import { Moon, Sun, LogOut, User, Bell } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Dark mode
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

/**
 * Derive a display title from the notification's merge data.
 * The backend stores { firstName, programName, sessionDates, ... } in mergeData.
 * No rendered subject is returned from the API — we construct one here.
 */
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

// ---------------------------------------------------------------------------
// Notification bell dropdown
// ---------------------------------------------------------------------------

function NotificationBell() {
  const { notifications, unreadCount, markRead } = useNotifications();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground",
            "hover:bg-accent hover:text-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            "z-50 w-80 rounded-lg border bg-popover shadow-md",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Aucune notification
              </p>
            ) : (
              notifications.slice(0, 8).map((n) => {
                const unread = n.status !== "read";
                return (
                  <DropdownMenu.Item
                    key={n.id}
                    className={cn(
                      "flex flex-col gap-0.5 px-3 py-2.5 cursor-pointer outline-none",
                      "hover:bg-accent transition-colors",
                      unread && "bg-primary/5"
                    )}
                    onSelect={() => {
                      if (unread) markRead.mutate(n.id);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {/* Unread dot */}
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
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle } = useDarkMode();

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
    <header className="flex h-14 items-center justify-between border-b bg-background px-6 shrink-0">
      {/* Left — page title injected by child routes via context/portal in the future */}
      <div />

      {/* Right controls */}
      <div className="flex items-center gap-1">
        {/* Notification bell */}
        <NotificationBell />

        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={isDark ? "Mode clair" : "Mode sombre"}
        >
          {isDark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* User menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold",
                "hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                "z-50 min-w-[180px] rounded-lg border bg-popover p-1 shadow-md",
                "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
              )}
            >
              {/* User info */}
              <div className="px-2 py-1.5 border-b mb-1">
                <p className="text-xs font-medium truncate">{user?.email}</p>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {user?.role}
                </p>
              </div>

              <DropdownMenu.Item
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent outline-none"
                onSelect={() => navigate({ to: "/profile" })}
              >
                <User className="h-3.5 w-3.5" />
                Mon profil
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="my-1 h-px bg-border" />

              <DropdownMenu.Item
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive cursor-pointer hover:bg-destructive/10 outline-none"
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
  );
}
