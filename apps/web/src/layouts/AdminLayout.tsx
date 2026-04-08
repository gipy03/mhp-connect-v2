import { useEffect } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar, MobileSidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileSidebarProvider } from "@/hooks/useMobileSidebar";

export function AdminLayout() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate({ to: "/" });
      } else if (!isAdmin) {
        navigate({ to: "/dashboard" });
      }
    }
  }, [user, isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <MobileSidebarProvider>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <MobileSidebar />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </TooltipProvider>
    </MobileSidebarProvider>
  );
}
