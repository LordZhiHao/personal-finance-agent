import { useState } from "react";
import { Badge, Button, Card, Input, Select } from "./ui";
import {
  useApplyRule,
  useCreateRule,
  useDeleteRule,
  useMeta,
  useRules,
  useUpdateRule,
} from "../hooks/api";
import type { Rule, RuleMatchType } from "../types";

const MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  description_contains: "Description contains",
  amount_equals: "Amount equals",
};

function RuleRow({ rule, categories }: { rule: Rule; categories: string[] }) {
  const updateMutation = useUpdateRule();
  const deleteMutation = useDeleteRule();
  const applyMutation = useApplyRule();
  const [matchType, setMatchType] = useState<RuleMatchType>(rule.match_type);
  const [pattern, setPattern] = useState(rule.pattern);
  const [category, setCategory] = useState(rule.category);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const dirty = matchType !== rule.match_type || pattern.trim() !== rule.pattern || category !== rule.category;

  function handleSave() {
    if (!dirty || !pattern.trim()) return;
    updateMutation.mutate({ id: rule.id, match_type: matchType, pattern: pattern.trim(), category });
  }

  function handleDelete() {
    if (!window.confirm(`Delete this rule? Past transactions keep whatever category they already have.`)) return;
    deleteMutation.mutate(rule.id);
  }

  function handleApply() {
    setApplyResult(null);
    applyMutation.mutate(
      { id: rule.id },
      {
        onSuccess: (result) =>
          setApplyResult(
            result.updated_count === 0
              ? "No past transactions matched."
              : `Updated ${result.updated_count} transaction${result.updated_count === 1 ? "" : "s"}.`,
          ),
      },
    );
  }

  return (
    <div className="py-2" style={{ borderBottom: "1px solid var(--gridline)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
          IF
        </span>
        <Select value={matchType} onChange={(e) => setMatchType(e.target.value as RuleMatchType)} className="w-48">
          <option value="description_contains">{MATCH_TYPE_LABELS.description_contains}</option>
          <option value="amount_equals">{MATCH_TYPE_LABELS.amount_equals}</option>
        </Select>
        <Input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder={matchType === "amount_equals" ? "e.g. 19.98" : "e.g. Grab"}
          className="flex-1 min-w-[120px]"
        />
        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
          →
        </span>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Badge tint="brand">{rule.hit_count} use{rule.hit_count === 1 ? "" : "s"}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <Button variant="outline" onClick={handleSave} disabled={!dirty || updateMutation.isPending}>
          {updateMutation.isPending ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" onClick={handleApply} disabled={applyMutation.isPending}>
          {applyMutation.isPending ? "Re-filing…" : "Re-file history"}
        </Button>
        <Button
          variant="ghost"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          style={{ color: "var(--tint-red-text)" }}
        >
          Delete
        </Button>
        {applyResult && (
          <span className="text-xs" style={{ color: "var(--tint-green-text)" }}>
            {applyResult}
          </span>
        )}
      </div>
    </div>
  );
}

export function RulesCard() {
  const metaQuery = useMeta();
  const rulesQuery = useRules();
  const createMutation = useCreateRule();

  const [matchType, setMatchType] = useState<RuleMatchType>("description_contains");
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState("");

  if (!metaQuery.data) return null;

  const categories = metaQuery.data.categories;
  const rules = rulesQuery.data ?? [];

  function handleAdd() {
    if (!pattern.trim() || !category) return;
    createMutation.mutate(
      { match_type: matchType, pattern: pattern.trim(), category },
      { onSuccess: () => setPattern("") },
    );
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Categories &amp; Auto-Rules
      </h2>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        Rules you've saved. Edit one and re-file it to update matching past transactions too.
      </p>

      {rules.length > 0 ? (
        <div className="mb-3">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} categories={categories} />
          ))}
        </div>
      ) : (
        <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
          No rules yet — add one below.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            New rule
          </span>
          <Select value={matchType} onChange={(e) => setMatchType(e.target.value as RuleMatchType)} className="w-48">
            <option value="description_contains">{MATCH_TYPE_LABELS.description_contains}</option>
            <option value="amount_equals">{MATCH_TYPE_LABELS.amount_equals}</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            &nbsp;
          </span>
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={matchType === "amount_equals" ? "e.g. 19.98" : "e.g. Grab"}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Category
          </span>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="primary"
          onClick={handleAdd}
          disabled={createMutation.isPending || !pattern.trim() || !category}
        >
          {createMutation.isPending ? "Adding…" : "＋ New Rule"}
        </Button>
      </div>
      {createMutation.isError && (
        <p className="text-sm mt-2" style={{ color: "var(--tint-red-text)" }}>
          Could not create rule — check the category is valid.
        </p>
      )}
    </Card>
  );
}
