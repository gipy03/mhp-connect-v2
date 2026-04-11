import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { Shield } from "lucide-react";

const schema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type FormValues = z.infer<typeof schema>;

export default function AdminLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (import.meta.env.DEV) {
      api.get<{ email: string; password: string }>("/admin-auth/dev-creds")
        .then((creds) => {
          setValue("email", creds.email);
          setValue("password", creds.password);
        })
        .catch(() => {});
    }
  }, [setValue]);

  const loginMutation = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      api.post<{ admin: { id: string; email: string; displayName: string | null; isSuperAdmin: boolean } }>("/admin-auth/login", creds),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await loginMutation.mutateAsync(data);
      window.location.href = "/user/admin/programs";
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Email ou mot de passe incorrect.");
      } else if (err instanceof ApiError && err.status === 429) {
        toast.error("Trop de tentatives. Réessayez plus tard.");
      } else {
        toast.error("Une erreur est survenue. Réessayez.");
      }
    }
  };

  return (
    <Card className="shadow-lg border-0 sm:border">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary/60" />
          <CardTitle className="text-xl">Administration</CardTitle>
        </div>
        <CardDescription>
          Espace réservé aux administrateurs
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="admin@exemple.com"
              className="h-10"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1 animate-fade-in">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              className="h-10"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive mt-1 animate-fade-in">{errors.password.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
            {isSubmitting ? "Connexion…" : "Se connecter"}
          </Button>

          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Retour à l'espace membre
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
