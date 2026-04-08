import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
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

const schema = z
  .object({
    password: z.string().min(8, "Au moins 8 caractères"),
    confirm: z.string().min(1, "Confirmez le mot de passe"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  // Token is passed as ?token= query param from the email link
  const { token } = useSearch({ strict: false }) as { token?: string };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    if (!token) {
      toast.error("Lien invalide ou expiré.");
      return;
    }
    try {
      await api.post("/auth/reset-password", {
        token,
        password: data.password,
      });
      toast.success("Mot de passe mis à jour.");
      navigate({ to: "/" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        toast.error("Ce lien est invalide ou a expiré.");
      } else {
        toast.error("Une erreur est survenue.");
      }
    }
  };

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lien invalide</CardTitle>
          <CardDescription>
            Ce lien de réinitialisation est invalide ou a expiré.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Demander un nouveau lien
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau mot de passe</CardTitle>
        <CardDescription>Choisissez un mot de passe sécurisé.</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmer</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              {...register("confirm")}
            />
            {errors.confirm && (
              <p className="text-xs text-destructive">{errors.confirm.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : "Enregistrer le mot de passe"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
