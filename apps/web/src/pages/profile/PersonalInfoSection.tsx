import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User } from "lucide-react";
import { toast } from "sonner";
import { useProfile, type UserProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Section, Grid2, Field, SaveRow } from "./shared";

const personalInfoSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  phone: z
    .string()
    .regex(/^(\+?\d[\d\s\-().]{6,20})?$/, "Format de téléphone invalide")
    .or(z.literal("")),
  birthdate: z.string(),
  nationality: z.string(),
  profession: z.string(),
});

type PersonalInfoValues = z.infer<typeof personalInfoSchema>;

export function PersonalInfoSection({
  profile,
  email,
}: {
  profile: UserProfile | null;
  email: string;
}) {
  const { updateProfile } = useProfile();
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PersonalInfoValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      phone: profile?.phone ?? "",
      birthdate: profile?.birthdate ?? "",
      nationality: profile?.nationality ?? "",
      profession: profile?.profession ?? "",
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        phone: profile.phone ?? "",
        birthdate: profile.birthdate ?? "",
        nationality: profile.nationality ?? "",
        profession: profile.profession ?? "",
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: PersonalInfoValues) => {
    try {
      await updateProfile.mutateAsync({
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        phone: data.phone || null,
        birthdate: data.birthdate || null,
        nationality: data.nationality || null,
        profession: data.profession || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Informations mises à jour.");
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    }
  };

  return (
    <Section title="Informations personnelles" icon={User}>
      <Grid2>
        <Field label="Prénom" error={errors.firstName?.message}>
          <Input {...register("firstName")} placeholder="Jean" />
        </Field>
        <Field label="Nom" error={errors.lastName?.message}>
          <Input {...register("lastName")} placeholder="Dupont" />
        </Field>
        <Field label="Email" className="sm:col-span-2">
          <Input value={email} disabled className="bg-muted/50" />
          <p className="text-xs text-muted-foreground">
            L'email ne peut pas être modifié ici.
          </p>
        </Field>
        <Field label="Téléphone" error={errors.phone?.message}>
          <Input
            {...register("phone")}
            placeholder="+41 79 123 45 67"
            type="tel"
          />
        </Field>
        <Field label="Date de naissance">
          <Input {...register("birthdate")} type="date" />
        </Field>
        <Field label="Nationalité">
          <Input {...register("nationality")} placeholder="Suisse" />
        </Field>
        <Field label="Profession">
          <Input {...register("profession")} placeholder="" />
        </Field>
      </Grid2>
      <SaveRow
        isPending={updateProfile.isPending}
        onSave={handleSubmit(onSubmit)}
        saved={saved}
      />
    </Section>
  );
}
