import { Outlet } from "@tanstack/react-router";

/**
 * PublicLayout — used for unauthenticated pages (login, register, etc.)
 * Full-viewport centred surface, no sidebar, no header.
 */
export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* App wordmark */}
        <div className="mb-8 text-center">
          <h1 className="text-lg font-semibold tracking-tight">
            mhp{" "}
            <span className="text-muted-foreground font-light">|</span>{" "}
            connect
          </h1>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
