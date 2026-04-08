import { Outlet } from "@tanstack/react-router";

/**
 * PublicLayout — used for unauthenticated pages (login, register, etc.)
 * Full-viewport centred surface, no sidebar, no header.
 */
export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
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

      <div className="flex justify-center pb-6">
        <img
          src="/swiss-made-software.png"
          alt="Swiss Made Software"
          className="h-10 object-contain opacity-80"
        />
      </div>
    </div>
  );
}
