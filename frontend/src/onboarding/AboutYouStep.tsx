import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field, Input, Select } from "../components/ui";
import { useMe, useMeta, useUpdateMe } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";
import { WizardFooter } from "./WizardFooter";

const GENDER_LABELS: Record<string, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  other: "Other",
};

const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: "Single",
  married: "Married",
  divorced: "Divorced",
  widowed: "Widowed",
  other: "Other",
};

const profileSchema = z.object({
  name: z.string().max(100, "Name must be at most 100 characters.").optional(),
  age: z
    .string()
    .optional()
    .refine((v) => !v || (Number(v) >= 13 && Number(v) <= 120), "Age must be between 13 and 120."),
  gender: z.string().optional(),
  gender_other_text: z.string().max(300).optional(),
  marital_status: z.string().optional(),
  marital_status_other_text: z.string().max(300).optional(),
  num_kids: z
    .string()
    .optional()
    .refine((v) => !v || (Number(v) >= 0 && Number(v) <= 20), "Must be between 0 and 20."),
  num_pets: z
    .string()
    .optional()
    .refine((v) => !v || (Number(v) >= 0 && Number(v) <= 20), "Must be between 0 and 20."),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

/** Merges the former ProfileStep (demographics) and PersonaStep (persona picker) into
 * one step, as two visually-separated sections — both are structured "who are you"
 * inputs. Each section keeps its original state management verbatim rather than being
 * unified into one form: the demographics half is react-hook-form+zod (needs RHF's
 * `values` sync since useMe() can resolve after first render), the persona half is a
 * plain useState with a "sync once on load" guard (not a form field in the RHF sense). */
export function AboutYouStep({ onNext, onBack }: OnboardingStepProps) {
  const meQuery = useMe();
  const metaQuery = useMeta();
  const profileMutation = useUpdateMe();
  const personaMutation = useUpdateMe();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name: meQuery.data?.name ?? "",
      age: meQuery.data?.age != null ? String(meQuery.data.age) : "",
      gender: meQuery.data?.gender ?? "",
      gender_other_text: meQuery.data?.gender_other_text ?? "",
      marital_status: meQuery.data?.marital_status ?? "",
      marital_status_other_text: meQuery.data?.marital_status_other_text ?? "",
      num_kids: meQuery.data ? String(meQuery.data.num_kids) : "0",
      num_pets: meQuery.data ? String(meQuery.data.num_pets) : "0",
    },
  });

  const gender = watch("gender");
  const maritalStatus = watch("marital_status");

  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [personaCustomText, setPersonaCustomText] = useState("");
  const [personaInitialized, setPersonaInitialized] = useState(false);

  if (meQuery.data && !personaInitialized) {
    setSelectedPersona(meQuery.data.persona);
    setPersonaCustomText(meQuery.data.persona_custom_text ?? "");
    setPersonaInitialized(true);
  }

  function onSubmit(values: ProfileFormValues) {
    profileMutation.mutate(
      {
        name: values.name?.trim() || null,
        age: values.age ? Number(values.age) : null,
        gender: values.gender || null,
        gender_other_text: values.gender === "other" ? values.gender_other_text?.trim() || null : null,
        marital_status: values.marital_status || null,
        marital_status_other_text:
          values.marital_status === "other" ? values.marital_status_other_text?.trim() || null : null,
        num_kids: values.num_kids ? Number(values.num_kids) : 0,
        num_pets: values.num_pets ? Number(values.num_pets) : 0,
      },
      {
        onSuccess: () => {
          if (!selectedPersona) {
            onNext();
            return;
          }
          personaMutation.mutate(
            {
              persona: selectedPersona,
              persona_custom_text: selectedPersona === "other" ? personaCustomText.trim() || null : null,
            },
            { onSuccess: () => onNext() }
          );
        },
      }
    );
  }

  if (!metaQuery.data) return null;

  const saving = isSubmitting || profileMutation.isPending || personaMutation.isPending;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Tell Finn about you
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Helps Finn tailor its tone and advice to your situation. Entirely optional, and editable anytime in
        Settings.
      </p>

      <form className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
          The basics
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name")} placeholder="e.g. Alex" className="w-full" />
          </Field>
          <Field label="Age" error={errors.age?.message}>
            <Input type="number" min="13" max="120" {...register("age")} placeholder="e.g. 28" className="w-full" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender">
            <Select {...register("gender")} className="w-full">
              <option value="">Prefer not to say</option>
              {metaQuery.data.genders.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g] ?? g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Marital status">
            <Select {...register("marital_status")} className="w-full">
              <option value="">Prefer not to say</option>
              {metaQuery.data.marital_statuses.map((m) => (
                <option key={m} value={m}>
                  {MARITAL_STATUS_LABELS[m] ?? m}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {gender === "other" && (
          <Field label="Describe your gender">
            <Input {...register("gender_other_text")} placeholder="Your own words" className="w-full" />
          </Field>
        )}
        {maritalStatus === "other" && (
          <Field label="Describe your marital status">
            <Input {...register("marital_status_other_text")} placeholder="Your own words" className="w-full" />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Number of kids" error={errors.num_kids?.message}>
            <Input type="number" min="0" max="20" {...register("num_kids")} className="w-full" />
          </Field>
          <Field label="Number of pets" error={errors.num_pets?.message}>
            <Input type="number" min="0" max="20" {...register("num_pets")} className="w-full" />
          </Field>
        </div>
      </form>

      <div
        className="text-xs font-semibold uppercase tracking-wide mt-5 mb-2 pt-4"
        style={{ color: "var(--text-muted)", borderTop: "1px solid var(--gridline)" }}
      >
        Which of these sounds like you?
      </div>
      <div className="space-y-2 mb-3">
        {metaQuery.data.personas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedPersona(p.id)}
            className="w-full text-left px-3 py-2.5"
            style={{
              borderRadius: "var(--radius-control)",
              border: selectedPersona === p.id ? "2px solid var(--brand)" : "1px solid var(--border)",
              background: "var(--surface-1)",
            }}
          >
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {p.label}
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {p.ui_description}
            </div>
          </button>
        ))}
      </div>

      {selectedPersona === "other" && (
        <Input
          value={personaCustomText}
          onChange={(e) => setPersonaCustomText(e.target.value)}
          placeholder="Describe your situation in your own words"
          className="w-full mb-3"
        />
      )}

      <WizardFooter
        onBack={onBack}
        onSkip={onNext}
        onPrimary={handleSubmit(onSubmit)}
        primaryLabel={saving ? "Saving…" : "Continue"}
        primaryDisabled={saving}
      />
    </div>
  );
}
