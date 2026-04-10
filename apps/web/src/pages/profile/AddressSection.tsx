import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { useProfile, type UserProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Section, Grid2, Field, SaveRow } from "./shared";

const addressSchema = z.object({
  roadAddress: z.string(),
  city: z.string(),
  cityCode: z.string(),
  country: z.string(),
});

type AddressValues = z.infer<typeof addressSchema>;

export function AddressSection({ profile }: { profile: UserProfile | null }) {
  const { updateProfile } = useProfile();
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, reset } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      roadAddress: profile?.roadAddress ?? "",
      city: profile?.city ?? "",
      cityCode: profile?.cityCode ?? "",
      country: profile?.country ?? "",
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        roadAddress: profile.roadAddress ?? "",
        city: profile.city ?? "",
        cityCode: profile.cityCode ?? "",
        country: profile.country ?? "",
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: AddressValues) => {
    try {
      await updateProfile.mutateAsync({
        roadAddress: data.roadAddress || undefined,
        city: data.city || undefined,
        cityCode: data.cityCode || undefined,
        country: data.country || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Adresse mise à jour.");
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    }
  };

  return (
    <Section
      title="Adresse"
      description="Le géocodage est effectué automatiquement lors de l'enregistrement."
      icon={MapPin}
    >
      <Grid2>
        <Field label="Rue / numéro" className="sm:col-span-2">
          <Input
            {...register("roadAddress")}
            placeholder="Rue des Alpes 12"
          />
        </Field>
        <Field label="NPA">
          <Input {...register("cityCode")} placeholder="1200" />
        </Field>
        <Field label="Ville">
          <Input {...register("city")} placeholder="Genève" />
        </Field>
        <Field label="Pays" className="sm:col-span-2">
          <Input {...register("country")} placeholder="Suisse" />
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
