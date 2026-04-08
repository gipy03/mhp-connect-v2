import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
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
import { ApiError } from "@/lib/api";

const schema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  email: z.string().email("Adresse email invalide"),
  password: z
    .string()
    .min(8, "Au moins 8 caractères"),
});

type FormValues = z.infer<typeof schema>;

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    try {
      await registerUser.mutateAsync(data);
      navigate({ to: "/dashboard" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Un compte existe déjà avec cette adresse email.");
      } else {
        toast.error("Une erreur est survenue. Réessayez.");
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un compte</CardTitle>
        <CardDescription>Rejoignez mhp | connect</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

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

          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Création…" : "Créer mon compte"}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            Déjà un compte ?{" "}
            <Link
              to="/"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
