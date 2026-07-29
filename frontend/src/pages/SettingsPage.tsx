import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "../components/ui/Card";
import { Button, Field, Input, Overlay, Select } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import {
  useAccounts,
  useCreateAccount,
  useCreateCategory,
  useCustomCategories,
  useDeleteAccount,
  useDeleteCategory,
  useGenerateTelegramLinkCode,
  useMeta,
  useUpdateAccount,
  useUpdateCategory,
  useUpdateMainCurrency,
} from "../hooks/api";
import type { Account, CustomCategory, Meta } from "../types";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required."),
  type: z.string().min(1),
  currency: z.string().min(1),
  comments: z.string().optional(),
});
type AccountFormValues = z.infer<typeof accountSchema>;

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required."),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

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
  const dirty = name.trim() !== "" && name !== category.name;

  function handleSave() {
    if (dirty) updateMutation.mutate({ id: category.id, name: name.trim() });
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
    <div className="flex items-center gap-2 py-1">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
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
  } = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema), defaultValues: { name: "" } });

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
          mutation.mutate(values.name, { onSuccess: () => reset() });
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

export function SettingsPage() {
  const { email, telegramLinked, refreshMe } = useAuth();
  const mutation = useGenerateTelegramLinkCode();

  async function handleGenerate() {
    await mutation.mutateAsync();
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-lg font-semibold" style={{ color: "var(--text-heading)" }}>
        Settings
      </h1>

      <Card>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
          Account
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {email}
        </p>
      </Card>

      <MainCurrencyCard />

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

      <AccountsCard />
      <CategoriesCard />
    </div>
  );
}
