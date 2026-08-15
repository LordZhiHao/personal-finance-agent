import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "../components/ui/Card";
import { Button, Field, Input, Overlay, Select } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { formatMoney } from "../lib/format";
import {
  useAccounts,
  useBudgetStatus,
  useContributeToGoal,
  useCreateAccount,
  useCreateBudget,
  useCreateCategory,
  useCreateGoal,
  useCreateMemory,
  useCustomCategories,
  useDeleteAccount,
  useDeleteBudget,
  useDeleteCategory,
  useDeleteGoal,
  useDeleteMemory,
  useGenerateTelegramLinkCode,
  useGoals,
  useMemories,
  useMeta,
  useUpdateAccount,
  useUpdateCategory,
  useUpdateHiddenDashboardSections,
  useUpdateMainCurrency,
  useUpdateTheme,
} from "../hooks/api";
import { DASHBOARD_SECTIONS, sectionKey, type DashboardView } from "../lib/dashboardSections";
import type { Account, BudgetStatus, CategoryClassification, CustomCategory, Goal, Memory, Meta } from "../types";

const CATEGORY_CLASSIFICATION_LABELS: Record<CategoryClassification, string> = {
  expense: "Expense (counts as spending)",
  income: "Income",
  transfer: "Transfer (between own accounts)",
  investment: "Investment (not spending)",
};

const accountSchema = z.object({
  name: z.string().min(1, "Name is required."),
  type: z.string().min(1),
  currency: z.string().min(1),
  comments: z.string().optional(),
});
type AccountFormValues = z.infer<typeof accountSchema>;

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required."),
  classification: z.enum(["expense", "income", "transfer", "investment"]),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

const memorySchema = z.object({
  content: z.string().min(1, "Please enter something to remember."),
});
type MemoryFormValues = z.infer<typeof memorySchema>;

const budgetSchema = z.object({
  category: z.string().min(1, "Category is required."),
  monthly_limit: z.coerce.number().positive("Must be greater than 0."),
});

const goalSchema = z.object({
  name: z.string().min(1, "Name is required."),
  target_amount: z.coerce.number().positive("Must be greater than 0."),
  target_date: z.string().optional(),
});

const contributeSchema = z.object({
  amount: z.coerce.number().positive("Must be greater than 0."),
});

function AccountDialog({
  account,
  meta,
  onClose,
}: {
  account?: Account;
  meta: Meta;
  onClose: () => void;
}) {
  const isEdit = Boolean(account);
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const mutation = isEdit ? updateMutation : createMutation;
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name ?? "",
      type: account?.type ?? meta.account_types[0] ?? "",
      currency: account?.currency ?? meta.currencies[0] ?? "",
      comments: account?.comments ?? "",
    },
  });

  function onSubmit(values: AccountFormValues) {
    setServerError(null);
    if (account) {
      updateMutation.mutate(
        { id: account.id, ...values },
        { onSuccess: onClose, onError: (err) => setServerError(err instanceof Error ? err.message : "Failed to save.") },
      );
    } else {
      createMutation.mutate(values, {
        onSuccess: onClose,
        onError: (err) => setServerError(err instanceof Error ? err.message : "Failed to save."),
      });
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-heading)" }}>
        {isEdit ? "Edit Account" : "Add Account"}
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Field label="Name" error={errors.name?.message}>
          <Input {...register("name")} placeholder="e.g. DBS" className="w-full" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select {...register("type")} className="w-full">
              {meta.account_types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Currency">
            <Select {...register("currency")} className="w-full">
              {meta.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Input {...register("comments")} placeholder="e.g. for US stock trades" className="w-full" />
        </Field>

        {serverError && (
          <p className="text-sm" style={{ color: "var(--tint-red-text)" }}>
            {serverError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Account"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function AccountRow({ account, meta }: { account: Account; meta: Meta }) {
  const deleteMutation = useDeleteAccount();
  const [editing, setEditing] = useState(false);

  function handleDelete() {
    if (
      !window.confirm(
        `Delete account "${account.name}"? Its past transactions/trades stay in your history — this just hides it from new entries.`,
      )
    )
      return;
    deleteMutation.mutate(account.id);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 py-2" style={{ borderBottom: "1px solid var(--gridline)" }}>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {account.name}
          </div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {account.type} · {account.currency}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            style={{ color: "var(--tint-red-text)" }}
          >
            Delete
          </Button>
        </div>
      </div>
      {editing && <AccountDialog account={account} meta={meta} onClose={() => setEditing(false)} />}
    </>
  );
}

function AccountsCard() {
  const accountsQuery = useAccounts();
  const metaQuery = useMeta();
  const [adding, setAdding] = useState(false);

  if (!metaQuery.data) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
          Your Accounts
        </h2>
        <Button variant="outline" onClick={() => setAdding(true)}>
          ＋ Add Account
        </Button>
      </div>
      <div>
        {(accountsQuery.data ?? []).map((a) => (
          <AccountRow key={a.id} account={a} meta={metaQuery.data} />
        ))}
        {accountsQuery.data?.length === 0 && (
          <p className="text-sm py-1" style={{ color: "var(--text-secondary)" }}>
            No accounts yet — tap "＋ Add Account" to create one.
          </p>
        )}
      </div>
      {adding && <AccountDialog meta={metaQuery.data} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function CategoryRow({ category }: { category: CustomCategory }) {
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const [name, setName] = useState(category.name);
  const [classification, setClassification] = useState<CategoryClassification>(category.classification);
  const dirty = (name.trim() !== "" && name !== category.name) || classification !== category.classification;

  function handleSave() {
    if (!dirty) return;
    const fields: { id: string; name?: string; classification?: CategoryClassification } = { id: category.id };
    if (name.trim() !== "" && name !== category.name) fields.name = name.trim();
    if (classification !== category.classification) fields.classification = classification;
    updateMutation.mutate(fields);
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Delete category "${category.name}"? Past transactions keep this label — it just won't be selectable anymore.`,
      )
    )
      return;
    deleteMutation.mutate(category.id);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[140px]" />
      <Select
        value={classification}
        onChange={(e) => setClassification(e.target.value as CategoryClassification)}
        className="w-full sm:w-56"
      >
        {Object.entries(CATEGORY_CLASSIFICATION_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleSave} disabled={!dirty || updateMutation.isPending}>
          {updateMutation.isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="ghost"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          style={{ color: "var(--tint-red-text)" }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function CategoriesCard() {
  const metaQuery = useMeta();
  const categoriesQuery = useCustomCategories();
  const mutation = useCreateCategory();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", classification: "expense" },
  });

  if (!metaQuery.data) return null;

  const customNames = new Set((categoriesQuery.data ?? []).map((c) => c.name));
  const builtins = metaQuery.data.categories.filter((name) => !customNames.has(name));

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-heading)" }}>
        Transaction Categories
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        Built-in: {builtins.join(", ")}
      </p>
      {(categoriesQuery.data?.length ?? 0) > 0 && (
        <div className="mb-3">
          {categoriesQuery.data!.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </div>
      )}
      <form
        onSubmit={handleSubmit((values) => {
          mutation.mutate(values, { onSuccess: () => reset() });
        })}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            New category
          </span>
          <Input {...register("name")} placeholder="e.g. Pet Care" />
          {errors.name && (
            <span className="text-xs" style={{ color: "var(--tint-red-text)" }}>
              {errors.name.message}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Classification
          </span>
          <Select {...register("classification")} className="w-56">
            {Object.entries(CATEGORY_CLASSIFICATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="primary" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? "Adding…" : "＋ Add Category"}
        </Button>
      </form>
      {mutation.isError && (
        <p className="text-sm mt-2" style={{ color: "var(--tint-red-text)" }}>
          Could not create category — it may already exist.
        </p>
      )}
    </Card>
  );
}

function MemoryRow({ memory }: { memory: Memory }) {
  const deleteMutation = useDeleteMemory();

  function handleDelete() {
    if (!window.confirm("Delete this memory? Finn will no longer take it into account.")) return;
    deleteMutation.mutate(memory.id);
  }

  return (
    <div
      className="flex items-center justify-between gap-2 py-2"
      style={{ borderBottom: "1px solid var(--gridline)" }}
    >
      <p className="text-sm min-w-0 break-words" style={{ color: "var(--text-primary)" }}>
        {memory.content}
      </p>
      <Button
        variant="ghost"
        onClick={handleDelete}
        disabled={deleteMutation.isPending}
        style={{ color: "var(--tint-red-text)" }}
      >
        Delete
      </Button>
    </div>
  );
}

function MemoriesCard() {
  const memoriesQuery = useMemories();
  const mutation = useCreateMemory();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MemoryFormValues>({ resolver: zodResolver(memorySchema), defaultValues: { content: "" } });

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        What Finn Knows About You
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        Finn saves preferences and goals you mention in chat automatically. Review or remove
        anything here, or add a note yourself.
      </p>
      {(memoriesQuery.data?.length ?? 0) > 0 && (
        <div className="mb-3">
          {memoriesQuery.data!.map((m) => (
            <MemoryRow key={m.id} memory={m} />
          ))}
        </div>
      )}
      {memoriesQuery.data?.length === 0 && (
        <p className="text-sm py-1" style={{ color: "var(--text-secondary)" }}>
          Nothing saved yet — chat with Finn or add a note below.
        </p>
      )}
      <form
        onSubmit={handleSubmit((values) => {
          mutation.mutate(values.content, { onSuccess: () => reset() });
        })}
        className="flex flex-wrap items-end gap-2 mt-2"
      >
        <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            New note
          </span>
          <Input {...register("content")} placeholder="e.g. Saving for a house downpayment" className="w-full" />
          {errors.content && (
            <span className="text-xs" style={{ color: "var(--tint-red-text)" }}>
              {errors.content.message}
            </span>
          )}
        </label>
        <Button type="submit" variant="primary" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? "Adding…" : "＋ Add Note"}
        </Button>
      </form>
    </Card>
  );
}

function ProgressBar({ fraction, overBudget }: { fraction: number; overBudget: boolean }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div
      className="w-full h-2 mt-1"
      style={{ background: "var(--gridline)", borderRadius: "var(--radius-control)" }}
    >
      <div
        className="h-2"
        style={{
          width: `${pct}%`,
          background: overBudget ? "var(--tint-red-text)" : "var(--brand)",
          borderRadius: "var(--radius-control)",
        }}
      />
    </div>
  );
}

function BudgetRow({ budget }: { budget: BudgetStatus }) {
  const deleteMutation = useDeleteBudget();
  const overBudget = budget.spent > budget.monthly_limit;

  function handleDelete() {
    if (!window.confirm(`Remove the budget for ${budget.category}?`)) return;
    deleteMutation.mutate(budget.id);
  }

  return (
    <div className="py-2" style={{ borderBottom: "1px solid var(--gridline)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {budget.category}
        </p>
        <div className="flex items-center gap-2">
          <span
            className="text-xs"
            style={{ color: overBudget ? "var(--tint-red-text)" : "var(--text-secondary)" }}
          >
            {formatMoney(budget.spent, budget.currency)} / {formatMoney(budget.monthly_limit, budget.currency)}
          </span>
          <Button
            variant="ghost"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            style={{ color: "var(--tint-red-text)" }}
          >
            Delete
          </Button>
        </div>
      </div>
      <ProgressBar fraction={budget.spent / budget.monthly_limit} overBudget={overBudget} />
    </div>
  );
}

function BudgetsCard() {
  const statusQuery = useBudgetStatus();
  const metaQuery = useMeta();
  const { mainCurrency } = useAuth();
  const mutation = useCreateBudget();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(budgetSchema), defaultValues: { category: "", monthly_limit: 0 } });

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Monthly Budgets
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        Set a monthly spending limit per category — Finn will let you know when you go over.
      </p>
      {(statusQuery.data?.length ?? 0) > 0 && (
        <div className="mb-3">
          {statusQuery.data!.map((b) => (
            <BudgetRow key={b.id} budget={b} />
          ))}
        </div>
      )}
      {statusQuery.data?.length === 0 && (
        <p className="text-sm py-1" style={{ color: "var(--text-secondary)" }}>
          No budgets set yet.
        </p>
      )}
      <form
        onSubmit={handleSubmit((values) => {
          mutation.mutate(
            { category: values.category, monthly_limit: values.monthly_limit, currency: mainCurrency },
            { onSuccess: () => reset() },
          );
        })}
        className="flex flex-wrap items-end gap-2 mt-2"
      >
        <label className="flex flex-col gap-1 min-w-[160px]">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Category
          </span>
          <Select {...register("category")} className="w-full">
            <option value="">Select…</option>
            {metaQuery.data?.categories
              .filter((c) => (metaQuery.data?.category_classifications[c] ?? "expense") === "expense")
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 w-32">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Monthly limit ({mainCurrency})
          </span>
          <Input type="number" step="0.01" {...register("monthly_limit")} className="w-full" />
        </label>
        <Button type="submit" variant="primary" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? "Saving…" : "＋ Add Budget"}
        </Button>
      </form>
      {(errors.category || errors.monthly_limit) && (
        <p className="text-xs mt-1" style={{ color: "var(--tint-red-text)" }}>
          {errors.category?.message || errors.monthly_limit?.message}
        </p>
      )}
    </Card>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const deleteMutation = useDeleteGoal();
  const contributeMutation = useContributeToGoal();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({ resolver: zodResolver(contributeSchema), defaultValues: { amount: 0 } });
  const fraction = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;

  function handleDelete() {
    if (!window.confirm(`Remove the goal "${goal.name}"?`)) return;
    deleteMutation.mutate(goal.id);
  }

  return (
    <div className="py-2" style={{ borderBottom: "1px solid var(--gridline)" }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            {goal.name}
          </p>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {formatMoney(goal.current_amount, goal.currency)} / {formatMoney(goal.target_amount, goal.currency)}
            {goal.target_date ? ` · by ${goal.target_date}` : ""}
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          style={{ color: "var(--tint-red-text)" }}
        >
          Delete
        </Button>
      </div>
      <ProgressBar fraction={fraction} overBudget={false} />
      <form
        onSubmit={handleSubmit((values) => {
          contributeMutation.mutate({ id: goal.id, amount: values.amount }, { onSuccess: () => reset() });
        })}
        className="flex items-center gap-2 mt-2"
      >
        <Input type="number" step="0.01" {...register("amount")} className="w-28" placeholder="Amount" />
        <Button type="submit" variant="outline" disabled={isSubmitting || contributeMutation.isPending}>
          {contributeMutation.isPending ? "Adding…" : "Add contribution"}
        </Button>
      </form>
    </div>
  );
}

function GoalsCard() {
  const goalsQuery = useGoals();
  const { mainCurrency } = useAuth();
  const mutation = useCreateGoal();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(goalSchema), defaultValues: { name: "", target_amount: 0, target_date: "" } });

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Savings Goals
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        Track progress toward a savings target. Add contributions here or by telling Finn.
      </p>
      {(goalsQuery.data?.length ?? 0) > 0 && (
        <div className="mb-3">
          {goalsQuery.data!.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </div>
      )}
      {goalsQuery.data?.length === 0 && (
        <p className="text-sm py-1" style={{ color: "var(--text-secondary)" }}>
          No goals yet.
        </p>
      )}
      <form
        onSubmit={handleSubmit((values) => {
          mutation.mutate(
            {
              name: values.name,
              target_amount: values.target_amount,
              currency: mainCurrency,
              target_date: values.target_date || undefined,
            },
            { onSuccess: () => reset() },
          );
        })}
        className="flex flex-wrap items-end gap-2 mt-2"
      >
        <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Goal name
          </span>
          <Input {...register("name")} placeholder="e.g. House downpayment" className="w-full" />
        </label>
        <label className="flex flex-col gap-1 w-32">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Target ({mainCurrency})
          </span>
          <Input type="number" step="0.01" {...register("target_amount")} className="w-full" />
        </label>
        <label className="flex flex-col gap-1 w-40">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Target date (optional)
          </span>
          <Input type="date" {...register("target_date")} className="w-full" />
        </label>
        <Button type="submit" variant="primary" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? "Saving…" : "＋ Add Goal"}
        </Button>
      </form>
      {(errors.name || errors.target_amount) && (
        <p className="text-xs mt-1" style={{ color: "var(--tint-red-text)" }}>
          {errors.name?.message || errors.target_amount?.message}
        </p>
      )}
    </Card>
  );
}

function MainCurrencyCard() {
  const { mainCurrency, refreshMe } = useAuth();
  const metaQuery = useMeta();
  const mutation = useUpdateMainCurrency();
  const [draft, setDraft] = useState(mainCurrency);
  const dirty = draft !== mainCurrency;

  useEffect(() => {
    if (!dirty) setDraft(mainCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainCurrency]);

  if (!metaQuery.data) return null;

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Main Currency
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        All amounts across the app are converted to this currency.
      </p>
      <div className="flex items-center gap-2">
        <Select value={draft} onChange={(e) => setDraft(e.target.value)} className="w-24">
          {metaQuery.data.currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate(draft, { onSuccess: () => refreshMe() })}
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

const THEME_SWATCHES: { value: string; label: string; color: string }[] = [
  { value: "green", label: "Green", color: "#00ad6c" },
  { value: "orange", label: "Orange", color: "#eb6834" },
];

function ThemeCard() {
  const { theme, refreshMe } = useAuth();
  const mutation = useUpdateTheme();
  const [draft, setDraft] = useState(theme);
  const dirty = draft !== theme;

  useEffect(() => {
    if (!dirty) setDraft(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Theme
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        Choose the accent color used across charts and the dashboard.
      </p>
      <div className="flex items-center gap-3">
        {THEME_SWATCHES.map((swatch) => (
          <button
            key={swatch.value}
            type="button"
            onClick={() => setDraft(swatch.value)}
            className="flex items-center gap-2 px-3 py-2"
            style={{
              borderRadius: "var(--radius-control)",
              border: draft === swatch.value ? `2px solid ${swatch.color}` : "1px solid var(--border)",
              background: "var(--surface-1)",
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 18, height: 18, background: swatch.color }}
            />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              {swatch.label}
            </span>
          </button>
        ))}
        <Button
          variant="outline"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate(draft, { onSuccess: () => refreshMe() })}
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

const DASHBOARD_VIEW_LABELS: Record<DashboardView, string> = {
  spending: "Spending",
  investments: "Investments",
};

function CustomizeDashboardCard() {
  const { hiddenDashboardSections, refreshMe } = useAuth();
  const mutation = useUpdateHiddenDashboardSections();
  const [draft, setDraft] = useState(hiddenDashboardSections);
  const dirty = JSON.stringify([...draft].sort()) !== JSON.stringify([...hiddenDashboardSections].sort());

  useEffect(() => {
    if (!dirty) setDraft(hiddenDashboardSections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenDashboardSections]);

  function toggle(key: string) {
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Customize Dashboard
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        Choose which charts show up on your Spending and Investments pages.
      </p>
      <div className="flex flex-col gap-4">
        {(["spending", "investments"] as DashboardView[]).map((view) => (
          <div key={view}>
            <h3 className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
              {DASHBOARD_VIEW_LABELS[view]}
            </h3>
            <div className="flex flex-col gap-1">
              {DASHBOARD_SECTIONS.filter((s) => s.view === view && !s.pinned).map((s) => {
                const key = sectionKey(view, s.id);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-black/[0.03]"
                    style={{ color: "var(--text-primary)", borderRadius: "var(--radius-control)" }}
                  >
                    <input
                      type="checkbox"
                      checked={!draft.includes(key)}
                      onChange={() => toggle(key)}
                      className="accent-[var(--brand)]"
                    />
                    {s.label}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Button
          variant="outline"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate(draft, { onSuccess: () => refreshMe() })}
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const { email, telegramLinked, refreshMe } = useAuth();
  const mutation = useGenerateTelegramLinkCode();

  async function handleGenerate() {
    await mutation.mutateAsync();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold" style={{ color: "var(--text-heading)" }}>
        Settings
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 flex flex-col gap-4">
          <Card>
            <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
              Account
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {email}
            </p>
          </Card>

          <MainCurrencyCard />
          <ThemeCard />

          <Card>
            <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-heading)" }}>
              Link Telegram
            </h2>
            {telegramLinked && !mutation.data ? (
              <p className="text-sm" style={{ color: "var(--tint-green-text)" }}>
                ✅ Already linked.
              </p>
            ) : (
              <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                Generate a code and send it to the bot as <code>/link &lt;code&gt;</code> to connect this account to
                Telegram.
              </p>
            )}

            {mutation.data && (
              <div className="mb-3 p-3 text-center" style={{ background: "var(--brand-tint)", borderRadius: "var(--radius-control)" }}>
                <p className="text-2xl font-mono font-semibold tracking-widest" style={{ color: "var(--brand-hover)" }}>
                  {mutation.data.code}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  Send <code>/link {mutation.data.code}</code> to the bot within {mutation.data.ttl_minutes} minutes.
                </p>
              </div>
            )}

            {mutation.isError && (
              <p className="text-sm mb-3" style={{ color: "var(--tint-red-text)" }}>
                Could not generate a code. Try again.
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGenerate} disabled={mutation.isPending}>
                {mutation.isPending ? "Generating…" : telegramLinked ? "Generate new code" : "Generate code"}
              </Button>
              {!telegramLinked && mutation.data && (
                <Button variant="ghost" onClick={() => refreshMe()}>
                  I've sent /link — refresh status
                </Button>
              )}
            </div>
          </Card>

          <CustomizeDashboardCard />
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4">
          <AccountsCard />
          <CategoriesCard />
          <BudgetsCard />
          <GoalsCard />
          <MemoriesCard />
        </div>
      </div>
    </div>
  );
}
