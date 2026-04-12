import { useNavigate } from "@tanstack/react-router";
import { ArrowRightLeft } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth, type PortalType } from "@/hooks/useAuth";
import { toast } from "sonner";

const PORTAL_CONFIG: Record<PortalType, { label: string; color: string; home: string }> = {
  member: {
    label: "Membre",
    color: "hsl(var(--primary))",
    home: "/dashboard",
  },
  trainer: {
    label: "Formateur",
    color: "hsl(14, 50%, 50%)",
    home: "/trainer/dashboard",
  },
  admin: {
    label: "Admin",
    color: "hsl(82, 40%, 35%)",
    home: "/admin/programs",
  },
};

export function PortalSwitcher() {
  const { availablePortals, activePortal, switchPortal } = useAuth();
  const navigate = useNavigate();

  if (availablePortals.length <= 1) return null;

  const current = PORTAL_CONFIG[activePortal];

  const handleSwitch = async (portal: PortalType) => {
    if (portal === activePortal) return;

    try {
      await switchPortal.mutateAsync(portal);
      const target = PORTAL_CONFIG[portal];
      navigate({ to: target.home });
    } catch {
      toast.error("Impossible de changer de portail.");
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            "border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          <div className="h-2 w-2 rounded-full" style={{ background: current.color }} />
          <span>{current.label}</span>
          <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className={cn(
            "z-50 min-w-[160px] rounded-lg border bg-popover p-1 shadow-lg",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        >
          <div className="px-2 py-1.5 border-b mb-1">
            <p className="text-xs font-medium text-muted-foreground">Changer de portail</p>
          </div>

          {availablePortals.map((portal) => {
            const config = PORTAL_CONFIG[portal];
            const isActive = portal === activePortal;

            return (
              <DropdownMenu.Item
                key={portal}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer outline-none transition-colors",
                  isActive ? "bg-accent font-medium" : "hover:bg-accent"
                )}
                onSelect={() => handleSwitch(portal)}
              >
                <div className="h-2 w-2 rounded-full" style={{ background: config.color }} />
                <span>{config.label}</span>
                {isActive && (
                  <span className="ml-auto text-[10px] text-muted-foreground">actif</span>
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
