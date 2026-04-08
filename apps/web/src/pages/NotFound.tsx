import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center py-20">
      <p className="text-5xl font-semibold tracking-tight text-muted-foreground/30">
        404
      </p>
      <div className="space-y-1">
        <h1 className="text-lg font-medium">Page introuvable</h1>
        <p className="text-sm text-muted-foreground">
          Cette page n'existe pas ou vous n'y avez pas accès.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/dashboard">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}
