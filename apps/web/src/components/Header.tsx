import { useNavigate } from "@tanstack/react-router";
import { Moon, Sun, LogOut, User, Bell } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
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

  const initials = user
    ? [user.email[0]].join("").toUpperCase()
    : "?";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6 shrink-0">
      {/* Left — page title injected by child routes via portal in the future */}
      <div />

      {/* Right controls */}
      <div className="flex items-center gap-1">
        {/* Notifications bell — placeholder until NotificationService is wired */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          onClick={() => navigate({ to: "/notifications" })}
        >
          <Bell className="h-4 w-4" />
        </Button>

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
