import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { TrainerSidebar, TrainerMobileSidebar } from "@/components/TrainerSidebar";
import { Header } from "@/components/Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileSidebarProvider } from "@/hooks/useMobileSidebar";
import { CompactFooter } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

export function TrainerLayout() {
  const { user, isLoading, availablePortals, activePortal, switchPortal } = useAuth();
  const navigate = useNavigate();
  const switchingRef = useRef(false);

  const hasTrainerAccess = availablePortals.includes("trainer");
  const needsSwitch = hasTrainerAccess && activePortal !== "trainer";

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate({ to: "/" });
      } else if (!hasTrainerAccess) {
        navigate({ to: "/dashboard" });
      } else if (needsSwitch && !switchingRef.current) {
        switchingRef.current = true;
        switchPortal.mutate("trainer", {
          onSettled: () => {
            switchingRef.current = false;
          },
        });
      }
    }
  }, [user, hasTrainerAccess, needsSwitch, isLoading, navigate, switchPortal]);

  if (isLoading || needsSwitch) {
    return (
      <div className="flex h-screen items-center justify-center bg-background" role="status" aria-label="Chargement">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-[hsl(14,50%,50%)]/20 border-t-[hsl(14,50%,50%)] animate-spin" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || !hasTrainerAccess) return null;

  return (
    <MobileSidebarProvider>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-screen overflow-hidden bg-background">
          <TrainerSidebar />
          <TrainerMobileSidebar />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
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
