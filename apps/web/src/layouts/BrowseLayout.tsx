import { Outlet, Link, useNavigate } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Dark mode (same pattern as Header)
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
// BrowseLayout
//
// Used for the public catalogue pages. No auth required.
// Shows a minimal sticky top navbar that adapts to auth state:
//   - Unauthenticated: logo, "Se connecter", "S'inscrire"
//   - Authenticated:   logo, "Mon espace" CTA
// ---------------------------------------------------------------------------

export function BrowseLayout() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle } = useDarkMode();

  const initials = user ? user.email[0].toUpperCase() : null;

  return (
    <div className="min-h-screen bg-background">
      {/* ---------------------------------------------------------------- */}
      {/* Sticky top nav                                                   */}
      {/* ---------------------------------------------------------------- */}
      <nav className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            to="/catalogue"
            className="text-sm font-semibold tracking-tight flex items-center gap-1.5 shrink-0"
          >
            <span>mhp</span>
            <span className="text-muted-foreground font-light">|</span>
            <span>connect</span>
          </Link>

          {/* Centre: catalogue label */}
          <p className="text-sm text-muted-foreground hidden sm:block">
            Catalogue de formations
          </p>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Dark mode */}
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

            {/* Auth state */}
            {!isLoading &&
              (user ? (
                /* Authenticated: avatar + dashboard link */
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => navigate({ to: "/dashboard" })}
                  >
                    Mon espace
                  </Button>
                  <button
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold",
                      "hover:opacity-90 transition-opacity"
                    )}
                    onClick={() => navigate({ to: "/dashboard" })}
                    aria-label="Mon espace"
                  >
                    {initials}
                  </button>
                </div>
              ) : (
                /* Unauthenticated */
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" className="text-xs" asChild>
                    <Link to="/">Se connecter</Link>
                  </Button>
                  <Button size="sm" className="text-xs" asChild>
                    <Link to="/register">S'inscrire</Link>
                  </Button>
                </div>
              ))}
          </div>
        </div>
      </nav>

      {/* ---------------------------------------------------------------- */}
      {/* Page content                                                     */}
      {/* ---------------------------------------------------------------- */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
