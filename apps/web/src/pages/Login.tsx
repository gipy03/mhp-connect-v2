import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api";

const schema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    try {
      await login.mutateAsync(data);
      const intent = localStorage.getItem("mhp_enroll_intent");
      if (intent) {
        try {
          const parsed = JSON.parse(intent);
          localStorage.removeItem("mhp_enroll_intent");
          if (parsed.programCode) {
            const searchParams: Record<string, string> = { enroll: "true" };
            if (parsed.sessionId) searchParams.sessionId = parsed.sessionId;
            navigate({ to: "/catalogue/$code", params: { code: parsed.programCode }, search: searchParams });
            return;
          }
        } catch { /* ignore malformed */ }
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Email ou mot de passe incorrect.");
      } else if (err instanceof ApiError && err.status === 429) {
        toast.error("Trop de tentatives. Réessayez dans 15 minutes.");
      } else {
        toast.error("Une erreur est survenue. Réessayez.");
      }
    }
  };

  return (
    <Card className="shadow-lg border-0 sm:border">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>
          Accédez à votre espace membre
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
              placeholder="prenom@exemple.com"
              className="h-10"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1 animate-fade-in">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Mot de passe oublié ?
              </Link>
            </div>
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

          <p className="text-sm text-muted-foreground text-center">
            Pas encore de compte ?{" "}
            <Link
              to="/register"
              className="text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors"
            >
              S'inscrire
            </Link>
          </p>
          <Link
            to="/admin-login"
            className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            Accès admin
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
