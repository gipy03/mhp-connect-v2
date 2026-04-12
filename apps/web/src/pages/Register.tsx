import { useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError } from "@/lib/api";

const schema = z
  .object({
    firstName: z.string().min(1, "Prénom requis"),
    lastName: z.string().min(1, "Nom requis"),
    email: z.string().email("Adresse email invalide"),
    password: z.string().min(8, "Au moins 8 caractères"),
    confirmPassword: z.string().min(1, "Confirmez le mot de passe"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [activationSent, setActivationSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    try {
      const result = await registerUser.mutateAsync({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      if (result.activationSent) {
        setActivationSent(true);
        return;
      }
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
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Un compte existe déjà avec cette adresse email.");
      } else {
        toast.error("Une erreur est survenue. Réessayez.");
      }
    }
  };

  if (activationSent) {
    return (
      <Card className="shadow-lg border-0 sm:border">
        <CardHeader>
          <CardTitle className="text-xl">Email d'activation envoyé</CardTitle>
          <CardDescription>
            Un compte existe déjà avec cette adresse email mais n'a pas encore
            été activé. Un email contenant un lien pour définir votre mot de
            passe vient de vous être envoyé.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            to="/"
            className="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            ← Retour à la connexion
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0 sm:border">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Créer un compte</CardTitle>
        <CardDescription>Rejoignez mhp | connect</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                className="h-10"
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive animate-fade-in">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                className="h-10"
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive animate-fade-in">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

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
              <p className="text-xs text-destructive animate-fade-in">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              className="h-10"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive animate-fade-in">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              className="h-10"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive animate-fade-in">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
            {isSubmitting ? "Création…" : "Créer mon compte"}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            Déjà un compte ?{" "}
            <Link
              to="/"
              className="text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors"
            >
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
