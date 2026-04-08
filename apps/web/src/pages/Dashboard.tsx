import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">Tableau de bord</h1>
      <p className="text-sm text-muted-foreground">
        Bonjour{user ? ` — ${user.email}` : ""}. Les pages arriveront ici.
      </p>
    </div>
  );
}
