import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "../components/ui/Card";
import { MobileSectionTabs } from "../components/MobileSectionTabs";
import { Button, Field, Input, Overlay, Select } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { formatMoney } from "../lib/format";
import {
  useAccounts,
  useBalances,
  useBudgetStatus,
  useContributeToGoal,
  useCreateAccount,
  useCreateBalanceCheckpoint,
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
  useMe,
  useMemories,
  useMeta,
  usePreferences,
  useUpdateAccount,
  useUpdateCategory,
  useUpdateHiddenDashboardSections,
  useUpdateMainCurrency,
  useUpdateMe,
  useUpdatePreferences,
  useUpdateTheme,
} from "../hooks/api";
import { DASHBOARD_SECTIONS, sectionKey, type DashboardView } from "../lib/dashboardSections";
import type {
  Account,
  AccountBalance,
  BudgetStatus,
  CategoryClassification,
  CustomCategory,
  Goal,
  Memory,
  Meta,
} from "../types";

const CATEGORY_CLASSIFICATION_LABELS: Record<CategoryClassification, string> = {
  expense: "Expense (counts as spending)",
  income: "Income",
  transfer: "Transfer (between own accounts)",
  investment: "Investment (not spending)",
};

const balanceCheckpointSchema = z.object({
  as_of: z.string().min(1, "Date is required."),
  stated_balance: z.coerce.number(),
});

// An account past this many days since its last checkpoint gets the amber staleness
// banner — mirrors utils/balances.py::STALE_AFTER_DAYS on the backend.
const STALE_AFTER_DAYS = 30;

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

function BalanceCheckpointDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const mutation = useCreateBalanceCheckpoint();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(balanceCheckpointSchema),
    defaultValues: { as_of: format(new Date(), "yyyy-MM-dd"), stated_balance: 0 },
  });

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Update balance
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Enter {account.name}'s real balance as of a date — Finn rolls transactions forward from there instead of
        from zero.
      </p>
      <form
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(
            { accountId: account.id, as_of: values.as_of, stated_balance: values.stated_balance, currency: account.currency },
            { onSuccess: onClose, onError: (err) => setServerError(err instanceof Error ? err.message : "Failed to save.") },
          );
        })}
        className="space-y-3"
      >
        <Field label="As of" error={errors.as_of?.message}>
          <Input type="date" {...register("as_of")} max={format(new Date(), "yyyy-MM-dd")} className="w-full" />
        </Field>
        <Field label={`Real balance (${account.currency})`} error={errors.stated_balance?.message}>
          <Input type="number" step="0.01" {...register("stated_balance")} className="w-full" />
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
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function AccountRow({
  account,
  meta,
  balanceInfo,
}: {
  account: Account;
  meta: Meta;
  balanceInfo?: AccountBalance;
}) {
  const deleteMutation = useDeleteAccount();
  const [editing, setEditing] = useState(false);
  const [updatingBalance, setUpdatingBalance] = useState(false);
  const isCash = account.type !== "brokerage";
  const stale = isCash && (balanceInfo?.days_stale ?? 0) > STALE_AFTER_DAYS;

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
      <div className="py-2" style={{ borderBottom: "1px solid var(--gridline)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {account.name}
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {account.type} · {account.currency}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isCash && balanceInfo?.balance != null && (
              <div className="text-right">
                <div className="text-sm font-medium tabular-nums" style={{ color: "var(--text-heading)" }}>
                  {formatMoney(balanceInfo.balance, account.currency)}
                </div>
                <div className="text-[11px]" style={{ color: stale ? "var(--tint-amber-text)" : "var(--text-muted)" }}>
                  {balanceInfo.last_checked_at ? `Checked ${balanceInfo.days_stale}d ago` : "Never checked"}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              {isCash && (
                <Button variant="outline" onClick={() => setUpdatingBalance(true)}>
                  Update balance
                </Button>
              )}
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
        </div>
        {stale && (
          <div
            className="mt-2 px-3 py-2 text-xs"
            style={{ background: "var(--tint-amber-bg)", color: "var(--tint-amber-text)", borderRadius: "var(--radius-control)" }}
          >
            Hasn't been checked in {balanceInfo!.days_stale} days. Confirm the real balance and Finn will reconcile
            the gap for you.
          </div>
        )}
      </div>
      {editing && <AccountDialog account={account} meta={meta} onClose={() => setEditing(false)} />}
      {updatingBalance && <BalanceCheckpointDialog account={account} onClose={() => setUpdatingBalance(false)} />}
    </>
  );
}

function AccountsCard() {
  const accountsQuery = useAccounts();
  const metaQuery = useMeta();
  const { mainCurrency } = useAuth();
  const balancesQuery = useBalances(mainCurrency);
  const [adding, setAdding] = useState(false);

  if (!metaQuery.data) return null;

  const balanceByAccountId = new Map((balancesQuery.data?.balances ?? []).map((b) => [b.account_id, b]));

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
      <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
        You keep these balances up to date yourself. Tap "Update balance" to correct one — Finn keeps the running
        total between corrections.
      </p>
      <div>
        {(accountsQuery.data ?? []).map((a) => (
          <AccountRow key={a.id} account={a} meta={metaQuery.data} balanceInfo={balanceByAccountId.get(a.id)} />
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

// A tiny mock net-worth hero, so choosing a theme previews the real card look
// instead of a bare color dot — mirrors NetWorthHeroCard's gradient at a fixed
// fake figure, at a fraction of the size.
const THEME_PREVIEWS: { value: string; label: string; gradient: string; border: string }[] = [
  { value: "green", label: "Green", gradient: "linear-gradient(135deg, #00ad6c 0%, #028f59 62%, #016b43 100%)", border: "#00ad6c" },
  { value: "orange", label: "Orange", gradient: "linear-gradient(135deg, #eb6834 0%, #bc532a 62%, #93401f 100%)", border: "#eb6834" },
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
        Pick the accent — you see the change before you commit.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        {THEME_PREVIEWS.map((preview) => {
          const active = draft === preview.value;
          return (
            <button
              key={preview.value}
              type="button"
              onClick={() => setDraft(preview.value)}
              className="flex flex-col gap-2 p-2 w-40 text-left"
              style={{
                borderRadius: "var(--radius-card)",
                border: active ? `2px solid ${preview.border}` : "1px solid var(--border)",
                background: "var(--surface-1)",
              }}
            >
              <div
                className="rounded-xl px-2.5 py-2 text-white"
                style={{ background: preview.gradient }}
              >
                <div className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.75)" }}>
                  NET WORTH
                </div>
                <div className="text-base font-semibold tabular-nums mt-0.5">SGD 148,920</div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {preview.label}
                </span>
                {active && (
                  <span
                    className="flex items-center justify-center rounded-full text-[10px] text-white"
                    style={{ width: 16, height: 16, background: preview.border }}
                  >
                    ✓
                  </span>
                )}
              </div>
            </button>
          );
        })}
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

function PreferencesCard() {
  const prefsQuery = usePreferences();
  const mutation = useUpdatePreferences();
  const [draft, setDraft] = useState<{ budget_nudge_threshold: number; weekly_recap: boolean } | null>(null);
  const current = draft ?? prefsQuery.data ?? null;
  const dirty =
    draft !== null &&
    prefsQuery.data !== undefined &&
    (draft.budget_nudge_threshold !== prefsQuery.data.budget_nudge_threshold ||
      draft.weekly_recap !== prefsQuery.data.weekly_recap);

  useEffect(() => {
    if (!dirty) setDraft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsQuery.data]);

  if (!current) return null;

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        How Finn Behaves
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        Each row says what happens, not what it's called.
      </p>
      <div className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: "1px solid var(--gridline)" }}>
        <div className="min-w-0 flex-1">
          <div className="text-sm" style={{ color: "var(--text-primary)" }}>
            Nudge me when a category hits a threshold
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            One message, not a stream — % of the category's monthly budget.
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Input
            type="number"
            min={1}
            max={100}
            value={current.budget_nudge_threshold}
            onChange={(e) => setDraft({ ...current, budget_nudge_threshold: Number(e.target.value) })}
            className="w-16"
          />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            %
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-sm" style={{ color: "var(--text-primary)" }}>
            Weekly Sunday recap
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            A short read of the week, in the app and on Telegram.
          </div>
        </div>
        <input
          type="checkbox"
          checked={current.weekly_recap}
          onChange={(e) => setDraft({ ...current, weekly_recap: e.target.checked })}
          className="accent-[var(--brand)]"
          style={{ width: 18, height: 18 }}
        />
      </div>
      <div className="mt-3">
        <Button
          variant="outline"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate(current, { onSuccess: () => setDraft(null) })}
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

function TelegramCard() {
  const { telegramLinked, refreshMe } = useAuth();
  const mutation = useGenerateTelegramLinkCode();

  async function handleGenerate() {
    await mutation.mutateAsync();
  }

  return (
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

const PROFILE_GENDER_LABELS: Record<string, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  other: "Other",
};

const PROFILE_MARITAL_STATUS_LABELS: Record<string, string> = {
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
  persona: z.string().optional(),
  persona_custom_text: z.string().max(300).optional(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfileCard() {
  const meQuery = useMe();
  const metaQuery = useMeta();
  const mutation = useUpdateMe();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty, isSubmitting },
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
      persona: meQuery.data?.persona ?? "",
      persona_custom_text: meQuery.data?.persona_custom_text ?? "",
    },
  });

  const gender = watch("gender");
  const maritalStatus = watch("marital_status");
  const persona = watch("persona");

  function onSubmit(values: ProfileFormValues) {
    setSaved(false);
    mutation.mutate(
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
        persona: values.persona || null,
        persona_custom_text: values.persona === "other" ? values.persona_custom_text?.trim() || null : null,
      },
      { onSuccess: () => setSaved(true) }
    );
  }

  if (!metaQuery.data) return null;

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        About You
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        Helps Finn tailor its tone and advice to your situation. Entirely optional.
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
                  {PROFILE_GENDER_LABELS[g] ?? g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Marital status">
            <Select {...register("marital_status")} className="w-full">
              <option value="">Prefer not to say</option>
              {metaQuery.data.marital_statuses.map((m) => (
                <option key={m} value={m}>
                  {PROFILE_MARITAL_STATUS_LABELS[m] ?? m}
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

        <Field label="Persona">
          <Select {...register("persona")} className="w-full">
            <option value="">Not set</option>
            {metaQuery.data.personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        {persona === "other" && (
          <Field label="Describe your situation">
            <Input {...register("persona_custom_text")} placeholder="Your own words" className="w-full" />
          </Field>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" variant="outline" disabled={!isDirty || isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
          {saved && !isDirty && (
            <span className="text-xs" style={{ color: "var(--tint-green-text)" }}>
              Saved.
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

type SettingsSection = "profile" | "accounts" | "categories" | "plans" | "finn" | "appearance";
const SETTINGS_SECTIONS: { value: SettingsSection; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "accounts", label: "Your Accounts" },
  { value: "categories", label: "Categories" },
  { value: "plans", label: "Spending Plans" },
  { value: "finn", label: "How Finn Behaves" },
  { value: "appearance", label: "Appearance" },
];

function SettingsSectionNavButton({
  section,
  active,
  onClick,
}: {
  section: { value: SettingsSection; label: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        borderRadius: "var(--radius-control)",
        background: active ? "var(--brand-tint)" : "transparent",
        color: active ? "var(--brand-hover)" : "var(--text-secondary)",
      }}
    >
      {section.label}
    </button>
  );
}

export function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>("profile");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold" style={{ color: "var(--text-heading)" }}>
        Settings
      </h1>

      <div className="md:hidden -mt-2 mb-2">
        <MobileSectionTabs tabs={SETTINGS_SECTIONS} active={section} onChange={setSection} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <nav className="hidden md:flex md:flex-col md:gap-1 md:col-span-3">
          {SETTINGS_SECTIONS.map((s) => (
            <SettingsSectionNavButton key={s.value} section={s} active={section === s.value} onClick={() => setSection(s.value)} />
          ))}
        </nav>

        <div className="md:col-span-9 flex flex-col gap-4">
          {section === "profile" && (
            <>
              <ProfileCard />
              <MemoriesCard />
            </>
          )}
          {section === "accounts" && <AccountsCard />}
          {section === "categories" && <CategoriesCard />}
          {section === "plans" && (
            <>
              <BudgetsCard />
              <GoalsCard />
            </>
          )}
          {section === "finn" && (
            <>
              <PreferencesCard />
              <TelegramCard />
            </>
          )}
          {section === "appearance" && (
            <>
              <MainCurrencyCard />
              <ThemeCard />
              <CustomizeDashboardCard />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
