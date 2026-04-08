import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface FeatureGateProps {
  feature: string;
  /** Toast message shown on redirect */
  message?: string;
  children: React.ReactNode;
}

/**
 * Redirects to /dashboard with a toast if the user lacks the required feature
 * grant. Shows a spinner while auth is loading.
 */
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
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
