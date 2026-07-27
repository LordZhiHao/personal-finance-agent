import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "../components/ui/Card";
import { Button, Input, Select } from "../components/ui";
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
} from "../hooks/api";
import type { Account, CustomCategory, Meta } from "../types";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required."),
  type: z.string().min(1),
  currency: z.string().min(1),
});
type AccountFormValues = z.infer<typeof accountSchema>;

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required."),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

function AccountRow({ account, meta }: { account: Account; meta: Meta }) {
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();
  const [draft, setDraft] = useState<{ name: string; type: string; currency: string; comments: string }>({
    name: account.name,
    type: account.type,
    currency: account.currency,
    comments: account.comments ?? "",
  });

  const dirty =
    draft.name !== account.name ||
    draft.type !== account.type ||
    draft.currency !== account.currency ||
    draft.comments !== (account.comments ?? "");

  function handleSave() {
    updateMutation.mutate({ id: account.id, ...draft });
  }

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
    <div className="flex flex-wrap items-end gap-2 py-2" style={{ borderBottom: "1px solid var(--gridline)" }}>
      <Input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        className="w-32"
      />
      <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="w-28">
        {meta.account_types.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Select
        value={draft.currency}
        onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
        className="w-20"
      >
        {meta.currencies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Input
        value={draft.comments}
        onChange={(e) => setDraft({ ...draft, comments: e.target.value })}
        placeholder="e.g. for US stock trades"
        className="flex-1 min-w-[10rem]"
      />
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

function AccountsCard() {
  const accountsQuery = useAccounts();
  const metaQuery = useMeta();
  const mutation = useCreateAccount();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", type: metaQuery.data?.account_types[0] ?? "", currency: metaQuery.data?.currencies[0] ?? "" },
  });

  if (!metaQuery.data) return null;

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-heading)" }}>
        Your Accounts
      </h2>
      <div className="mb-3">
        {(accountsQuery.data ?? []).map((a) => (
          <AccountRow key={a.id} account={a} meta={metaQuery.data} />
        ))}
        {accountsQuery.data?.length === 0 && (
          <p className="text-sm py-1" style={{ color: "var(--text-secondary)" }}>
            No accounts yet — create one below.
          </p>
        )}
      </div>
      <form
        onSubmit={handleSubmit((values) => {
          mutation.mutate(values, { onSuccess: () => reset() });
        })}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Name
          </span>
          <Input {...register("name")} placeholder="e.g. DBS" />
          {errors.name && (
            <span className="text-xs" style={{ color: "var(--tint-red-text)" }}>
              {errors.name.message}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Type
          </span>
          <Select {...register("type")}>
            {metaQuery.data.account_types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Currency
          </span>
          <Select {...register("currency")}>
            {metaQuery.data.currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="primary" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? "Adding…" : "＋ Add Account"}
        </Button>
      </form>
      {mutation.isError && (
        <p className="text-sm mt-2" style={{ color: "var(--tint-red-text)" }}>
          Could not create account. Try again.
        </p>
      )}
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

export function SettingsPage() {
  const { email, telegramLinked, refreshMe } = useAuth();
  const mutation = useGenerateTelegramLinkCode();

  async function handleGenerate() {
    await mutation.mutateAsync();
  }

  return (
    <div className="space-y-6 max-w-xl">
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
