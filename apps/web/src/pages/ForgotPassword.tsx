import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Adresse email invalide"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    // Always succeeds — API never reveals whether email exists
    await api.post("/auth/forgot-password", data).catch(() => null);
    setSent(true);
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email envoyé</CardTitle>
          <CardDescription>
            Si un compte existe pour cette adresse, vous recevrez un lien de
            réinitialisation dans les prochaines minutes.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Retour à la connexion
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe oublié</CardTitle>
        <CardDescription>
          Entrez votre adresse email pour recevoir un lien de réinitialisation.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="prenom@exemple.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Envoi…" : "Envoyer le lien"}
          </Button>

          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retour à la connexion
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
