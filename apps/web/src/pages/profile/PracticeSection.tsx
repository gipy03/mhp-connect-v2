import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { useProfile, type UserProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section, Grid2, Field, SaveRow } from "./shared";

const practiceSchema = z.object({
  practiceName: z.string(),
  website: z
    .string()
    .url("URL invalide (ex: https://www.monsite.ch)")
    .or(z.literal("")),
  bio: z.string(),
});

type PracticeValues = z.infer<typeof practiceSchema>;

function SpecialtiesInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ajouter une spécialité…"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!input.trim()}
        >
          Ajouter
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => remove(tag)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              title="Retirer"
              aria-label={`Retirer ${tag}`}
            >
              {tag}
              <span className="text-muted-foreground/60 hover:text-destructive">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PracticeSection({ profile }: { profile: UserProfile | null }) {
  const { updateProfile } = useProfile();
  const [saved, setSaved] = useState(false);
  const [specialties, setSpecialties] = useState<string[]>(
    profile?.specialties ?? []
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PracticeValues>({
    resolver: zodResolver(practiceSchema),
    defaultValues: {
      practiceName: profile?.practiceName ?? "",
      website: profile?.website ?? "",
      bio: profile?.bio ?? "",
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        practiceName: profile.practiceName ?? "",
        website: profile.website ?? "",
        bio: profile.bio ?? "",
      });
      setSpecialties(profile.specialties ?? []);
    }
  }, [profile, reset]);

  const onSubmit = async (data: PracticeValues) => {
    try {
      await updateProfile.mutateAsync({
        practiceName: data.practiceName || undefined,
        specialties: specialties.length > 0 ? specialties : undefined,
        bio: data.bio || undefined,
        website: data.website || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Informations cabinet mises à jour.");
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    }
  };

  return (
    <Section
      title="Informations cabinet"
      description="Ces informations apparaissent dans l'annuaire des praticiens."
      icon={Globe}
    >
      <div className="space-y-4">
        <Grid2>
          <Field label="Nom du cabinet / pratique" className="sm:col-span-2">
            <Input
              {...register("practiceName")}
              placeholder="Cabinet de psychothérapie…"
            />
          </Field>
          <Field
            label="Site web"
            className="sm:col-span-2"
            error={errors.website?.message}
          >
            <Input
              {...register("website")}
              placeholder="https://www.monsite.ch"
              type="url"
            />
          </Field>
        </Grid2>

        <Field label="Spécialités">
          <SpecialtiesInput value={specialties} onChange={setSpecialties} />
        </Field>

        <Field label="Biographie">
          <Textarea
            {...register("bio")}
            placeholder="Décrivez votre approche thérapeutique et votre parcours professionnel…"
            className="min-h-[120px]"
          />
        </Field>
      </div>
      <SaveRow
        isPending={updateProfile.isPending}
        onSave={handleSubmit(onSubmit)}
        saved={saved}
      />
    </Section>
  );
}
