import { BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarSection } from "./profile/AvatarSection";
import { PersonalInfoSection } from "./profile/PersonalInfoSection";
import { AddressSection } from "./profile/AddressSection";
import { PracticeSection } from "./profile/PracticeSection";
import { DirectorySection } from "./profile/DirectorySection";
import { CredentialsSection } from "./profile/CredentialsSection";
import { PasswordSection } from "./profile/PasswordSection";

export default function Profile() {
  const { user, hasFeature } = useAuth();
  const { profileData, isLoading, isError } = useProfile();

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-5 pb-12" role="status" aria-label="Chargement du profil">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md col-span-2" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 rounded-md col-span-2" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        Impossible de charger votre profil. Réessayez dans un instant.
      </div>
    );
  }

  const profile = profileData?.profile ?? null;
  const credentials = profileData?.credentials ?? [];
  const email = user?.email ?? "";
  const hasDirectory = hasFeature("directory");

  return (
    <div className="max-w-2xl space-y-5 pb-12 animate-page-enter">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez vos informations personnelles et les paramètres de votre compte.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <AvatarSection profile={profile} email={email} />
      </div>

      <PersonalInfoSection profile={profile} email={email} />

      <AddressSection profile={profile} />

      {hasDirectory && (
        <>
          <PracticeSection profile={profile} />
          <DirectorySection profile={profile} email={email} />
        </>
      )}

      {credentials.length > 0 && (
        <CredentialsSection credentials={credentials} />
      )}

      <PasswordSection />

      {!hasDirectory && (
        <div className="rounded-xl border border-dashed p-5 space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Annuaire des praticiens</p>
          </div>
          <p className="text-xs text-muted-foreground">
            L'accès à l'annuaire et la gestion de votre fiche praticien sont
            disponibles après avoir complété une formation MHP certifiante.
          </p>
        </div>
      )}
    </div>
  );
}
