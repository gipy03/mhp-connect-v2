import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

interface FeatureGateProps {
  feature: string;
  message?: string;
  children: React.ReactNode;
}

export function FeatureGate({
  feature,
  message = "Cette fonctionnalité n'est pas disponible avec votre compte.",
  children,
}: FeatureGateProps) {
  const { hasFeature, isLoading } = useAuth();
  const navigate = useNavigate();
  const allowed = hasFeature(feature);

  useEffect(() => {
    if (!isLoading && !allowed) {
      toast.error("Accès refusé", { description: message, duration: 5000 });
      navigate({ to: "/dashboard" });
    }
  }, [isLoading, allowed, navigate, message]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4" role="status" aria-label="Vérification des accès">
        <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28 mx-auto" />
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
