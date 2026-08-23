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
  num_kids: z.coerce.number().int().min(0, "Must be 0 or more.").max(20, "Must be 20 or fewer."),
  num_pets: z.coerce.number().int().min(0, "Must be 0 or more.").max(20, "Must be 20 or fewer."),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileStep({ onNext, onBack }: OnboardingStepProps) {
  const meQuery = useMe();
  const metaQuery = useMeta();
  const updateMutation = useUpdateMe();
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
      num_kids: meQuery.data?.num_kids ?? 0,
      num_pets: meQuery.data?.num_pets ?? 0,
    },
  });

  const gender = watch("gender");
  const maritalStatus = watch("marital_status");

  function onSubmit(values: ProfileFormValues) {
    updateMutation.mutate(
      {
        name: values.name?.trim() || null,
        age: values.age ? Number(values.age) : null,
        gender: values.gender || null,
        gender_other_text: values.gender === "other" ? values.gender_other_text?.trim() || null : null,
        marital_status: values.marital_status || null,
        marital_status_other_text:
          values.marital_status === "other" ? values.marital_status_other_text?.trim() || null : null,
        num_kids: values.num_kids,
        num_pets: values.num_pets,
      },
      { onSuccess: () => onNext() }
    );
  }

  if (!metaQuery.data) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        A bit about you
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Helps Finn tailor its tone and advice to your situation. Entirely optional, and editable anytime in
        Settings.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
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

      <WizardFooter
        onBack={onBack}
        onSkip={onNext}
        onPrimary={handleSubmit(onSubmit)}
        primaryLabel={isSubmitting || updateMutation.isPending ? "Saving…" : "Continue"}
        primaryDisabled={isSubmitting || updateMutation.isPending}
      />
    </div>
  );
}
