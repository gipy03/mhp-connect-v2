import { useAuth } from "@/hooks/useAuth";

export default function TrainerDashboard() {
  const { user, firstName } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Espace Formateur
        </h1>
        <p className="text-muted-foreground mt-1">
          Bienvenue{firstName ? `, ${firstName}` : ""} ! Cet espace est dédié aux formateurs MHP.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(14,50%,50%)]/10">
            <span className="text-lg">🎓</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Tableau de bord formateur</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Les fonctionnalités formateur (sessions, étudiants, présences) seront bientôt disponibles.
        </p>
      </div>
    </div>
  );
}
