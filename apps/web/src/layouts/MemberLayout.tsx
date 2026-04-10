import { useEffect } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar, MobileSidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileSidebarProvider } from "@/hooks/useMobileSidebar";
import { CompactFooter } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

export function MemberLayout() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: "/" });
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background" role="status" aria-label="Chargement de l'application">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <MobileSidebarProvider>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-screen overflow-hidden bg-background">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium focus:shadow-lg"
          >
            Aller au contenu principal
          </a>
          <Sidebar />
          <MobileSidebar />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Header />
            <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="flex flex-col min-h-full">
                <div className="flex-1 animate-page-enter">
                  <Outlet />
                </div>
                <CompactFooter />
              </div>
            </main>
          </div>
        </div>
      </TooltipProvider>
    </MobileSidebarProvider>
  );
}
