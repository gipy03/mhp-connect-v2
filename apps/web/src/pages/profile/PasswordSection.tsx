import { useState, useCallback } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Section, Field, SaveRow } from "./shared";

export function PasswordSection() {
  const { changePassword } = useProfile();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (form.newPassword !== form.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error("Le nouveau mot de passe doit comporter au moins 8 caractères.");
      return;
    }
    try {
      await changePassword.mutateAsync({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Mot de passe modifié.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du changement de mot de passe.";
      toast.error(message);
    }
  };

  const EyeToggle = useCallback(
    ({ show, toggle }: { show: boolean; toggle: () => void }) => (
      <button
        type="button"
        onClick={toggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm"
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    ),
    []
  );

  return (
    <Section title="Mot de passe" icon={Lock}>
      <div className="space-y-4 max-w-sm">
        <Field label="Mot de passe actuel">
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              value={form.currentPassword}
              onChange={set("currentPassword")}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <EyeToggle
              show={showCurrent}
              toggle={() => setShowCurrent((s) => !s)}
            />
          </div>
        </Field>
        <Field label="Nouveau mot de passe">
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={form.newPassword}
              onChange={set("newPassword")}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <EyeToggle
              show={showNew}
              toggle={() => setShowNew((s) => !s)}
            />
          </div>
          {form.newPassword.length > 0 && form.newPassword.length < 8 && (
            <p className="text-xs text-destructive">
              Minimum 8 caractères.
            </p>
          )}
        </Field>
        <Field label="Confirmer le nouveau mot de passe">
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <EyeToggle
              show={showConfirm}
              toggle={() => setShowConfirm((s) => !s)}
            />
          </div>
          {form.confirmPassword.length > 0 &&
            form.newPassword !== form.confirmPassword && (
              <p className="text-xs text-destructive">
                Les mots de passe ne correspondent pas.
              </p>
            )}
        </Field>
      </div>
      <SaveRow
        isPending={changePassword.isPending}
        onSave={handleSave}
        saved={saved}
      />
    </Section>
  );
}
