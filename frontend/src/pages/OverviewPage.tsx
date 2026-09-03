import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, subDays, subMonths } from "date-fns";
import { LayoutDashboard } from "lucide-react";
import {
  useBalances,
  useBudgetStatus,
  useCreateBudget,
  useExpenseSummary,
  useMeta,
  useSnapshotHistory,
  useTransactions,
} from "../hooks/api";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/ui/Card";
import { NetWorthHeroCard } from "../components/charts/NetWorthHeroCard";
import { SpendRingCard, type RingCategoryRow } from "../components/charts/SpendRingCard";
import { FinnInsightCard } from "../components/FinnInsightCard";
import { LoadingFinn } from "../components/LoadingFinn";
import { categoryColorOrder, colorForKey } from "../lib/palette";
import { formatMoney } from "../lib/format";

const today = format(new Date(), "yyyy-MM-dd");

export function OverviewPage() {
  const navigate = useNavigate();
  const { mainCurrency, email } = useAuth();
  const [capSet, setCapSet] = useState(false);

  const balancesQuery = useBalances(mainCurrency);
  const historyQuery = useSnapshotHistory(mainCurrency);
  const metaQuery = useMeta();
  const budgetStatusQuery = useBudgetStatus();
  const createBudget = useCreateBudget();

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const prevMonthStart = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
  const prevMonthEnd = format(subDays(startOfMonth(new Date()), 1), "yyyy-MM-dd");
  const currentSummaryQuery = useExpenseSummary(monthStart, today);
  const prevSummaryQuery = useExpenseSummary(prevMonthStart, prevMonthEnd);

  const recentStart = format(subDays(new Date(), 14), "yyyy-MM-dd");
  const recentTxQuery = useTransactions(recentStart, today, mainCurrency);

  const classifications = metaQuery.data?.category_classifications ?? {};
  const categories = metaQuery.data?.categories ?? [];
  const categoryColors = useMemo(
    () => categoryColorOrder(categories, classifications),
    [categories, classifications],
  );

  // Cash = bank + ewallet balances; Invested = brokerage balances — both from the
  // same compute_account_balances() response so they always sum to `total`.
  const { cashTotal, investedTotal } = useMemo(() => {
    let cash = 0;
    let invested = 0;
    for (const b of balancesQuery.data?.balances ?? []) {
      if (b.balance === null) continue;
      if (b.type === "brokerage") invested += b.balance;
      else cash += b.balance;
    }
    return { cashTotal: cash, investedTotal: invested };
  }, [balancesQuery.data]);
  const netWorth = balancesQuery.data?.total ?? cashTotal + investedTotal;

  // Sparkline/delta are brokerage-only (asset_snapshots history) — cash has no
  // history endpoint yet (see CLAUDE.md's "Known, deliberately out-of-scope gap"
  // under Currency & Theme Preferences), so this trend understates true net worth
  // movement when cash balances swing a lot. Good enough for a decorative sparkline.
  const monthlyBrokerageValues = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of historyQuery.data ?? []) {
      byDate.set(s.snapshot_date, (byDate.get(s.snapshot_date) ?? 0) + s.converted_value);
    }
    const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
    const byMonth = new Map<string, number>();
    for (const [date, value] of sorted) byMonth.set(date.slice(0, 7), value);
    return [...byMonth.values()].slice(-6);
  }, [historyQuery.data]);

  const netWorthDelta = useMemo(() => {
    if (monthlyBrokerageValues.length < 2) return null;
    const last = monthlyBrokerageValues[monthlyBrokerageValues.length - 1];
    const prev = monthlyBrokerageValues[monthlyBrokerageValues.length - 2];
    const abs = last - prev;
    const pct = prev !== 0 ? (abs / prev) * 100 : null;
    return { abs, pct };
  }, [monthlyBrokerageValues]);

  // Budgeted plan total — only budgets already in the account's main currency count
  // toward "plan", since spend/limit aren't FX-converted against each other here.
  const { planTotal, spentTotal, categoryDeltas } = useMemo(() => {
    const rows = (budgetStatusQuery.data ?? []).filter((b) => b.currency === mainCurrency);
    const plan = rows.reduce((sum, b) => sum + b.monthly_limit, 0);
    const spent = rows.reduce((sum, b) => sum + b.spent, 0);

    const currentByCategory = currentSummaryQuery.data?.by_category ?? {};
    const prevByCategory = prevSummaryQuery.data?.by_category ?? {};
    const deltas = Object.entries(currentByCategory)
      .filter(([cat]) => (classifications[cat] ?? "expense") === "expense")
      .map(([category, amount]) => {
        const prevAmount = prevByCategory[category] ?? 0;
        const deltaPct = prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : undefined;
        return { category, amount, deltaAbs: amount - prevAmount, deltaPct };
      })
      .sort((a, b) => b.amount - a.amount);

    return { planTotal: plan, spentTotal: spent, categoryDeltas: deltas };
  }, [budgetStatusQuery.data, currentSummaryQuery.data, prevSummaryQuery.data, classifications, mainCurrency]);

  const monthSpend = currentSummaryQuery.data?.expenses ?? 0;
  const pctUsed = planTotal > 0 ? (spentTotal / planTotal) * 100 : null;
  const topCategories = categoryDeltas.slice(0, 5);
  const maxAmount = topCategories[0]?.amount ?? 1;
  const ringRows: RingCategoryRow[] = topCategories.map((c) => ({
    name: c.category,
    color: colorForKey(c.category, categoryColors),
    amount: c.amount,
    widthPct: (c.amount / maxAmount) * 100,
    deltaPct: c.deltaPct !== undefined ? Math.round(c.deltaPct) : undefined,
  }));

  // Nudge candidate: the category with the largest dollar increase vs last month,
  // above a small noise floor — a stand-in for the real persisted-nudge system
  // (CLAUDE.md's Finance Q&A Agent / scheduler), computed here from data already
  // on the page rather than a new backend contract.
  const nudge = useMemo(() => {
    const candidate = categoryDeltas.find((c) => c.deltaAbs > 30 && (c.deltaPct ?? 0) > 15);
    return candidate ?? null;
  }, [categoryDeltas]);

  const recentActivity = useMemo(
    () => [...(recentTxQuery.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
    [recentTxQuery.data],
  );

  function handleSetCap() {
    if (!nudge) return;
    const suggestedLimit = Math.ceil(nudge.amount / 10) * 10;
    createBudget.mutate(
      { category: nudge.category, monthly_limit: suggestedLimit, currency: mainCurrency },
      { onSuccess: () => setCapSet(true) },
    );
  }

  if (balancesQuery.isLoading || currentSummaryQuery.isLoading) {
    return <LoadingFinn />;
  }

  const firstName = email?.split("@")[0] ?? "there";

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-mono tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
          {format(new Date(), "EEEE, d MMMM yyyy").toUpperCase()}
        </div>
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold" style={{ color: "var(--text-heading)" }}>
          <LayoutDashboard size={22} />
          Welcome back, {firstName}
        </h1>
      </div>

      <NetWorthHeroCard
        label="Total Net Worth"
        value={formatMoney(netWorth, mainCurrency)}
        deltaText={
          netWorthDelta
            ? `${formatMoney(Math.abs(netWorthDelta.abs), mainCurrency)}${netWorthDelta.pct !== null ? ` (${netWorthDelta.pct >= 0 ? "+" : ""}${netWorthDelta.pct.toFixed(1)}%)` : ""} this month`
            : undefined
        }
        deltaDirection={netWorthDelta && netWorthDelta.abs < 0 ? "down" : "up"}
        sparkline={monthlyBrokerageValues}
        secondaryStats={[
          { label: "Cash", value: formatMoney(cashTotal, mainCurrency) },
          { label: "Invested", value: formatMoney(investedTotal, mainCurrency) },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-7">
          <SpendRingCard
            headline={
              planTotal > 0 ? (
                <>
                  You've spent <b style={{ color: "var(--brand-hover)" }}>{formatMoney(spentTotal, mainCurrency)}</b> of your{" "}
                  {formatMoney(planTotal, mainCurrency)} plan this month.
                </>
              ) : (
                <>
                  You've spent <b style={{ color: "var(--brand-hover)" }}>{formatMoney(monthSpend, mainCurrency)}</b> so far
                  this month.
                </>
              )
            }
            pctUsed={pctUsed}
            categories={ringRows}
            currency={mainCurrency}
            footnote={
              <>
                <span style={{ color: "var(--text-muted)" }}>
                  {Math.max(0, categoryDeltas.length - topCategories.length)} more categories
                </span>
                <button
                  type="button"
                  onClick={() => navigate("/spending")}
                  className="font-medium"
                  style={{ color: "var(--brand-hover)" }}
                >
                  All spending →
                </button>
              </>
            }
          />
        </div>

        <div className="lg:col-span-5">
          {nudge && !capSet ? (
            <FinnInsightCard
              subeyebrow="JUST NOW"
              body={
                <>
                  <b>{nudge.category}</b> is up {formatMoney(nudge.deltaAbs, mainCurrency)} on last month
                  {nudge.deltaPct !== undefined ? ` (+${Math.round(nudge.deltaPct)}%)` : ""}. Want a cap with a nudge at 80%?
                </>
              }
              actions={[
                { label: createBudget.isPending ? "Setting…" : "Set the cap", onClick: handleSetCap, disabled: createBudget.isPending },
                { label: "Ask Finn something", variant: "outline", onClick: () => navigate("/chat") },
              ]}
            />
          ) : capSet && nudge ? (
            <FinnInsightCard
              body={
                <>
                  Done — I set a {formatMoney(Math.ceil(nudge.amount / 10) * 10, mainCurrency)} cap on {nudge.category}.
                  You can adjust it any time from Settings.
                </>
              }
            />
          ) : (
            <FinnInsightCard
              body="Nothing jumped out at me this month — spending looks steady across your categories."
              actions={[{ label: "Ask Finn something", variant: "outline", onClick: () => navigate("/chat") }]}
            />
          )}
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] font-mono tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              LATEST ACTIVITY
            </div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text-heading)" }}>
              Finn logged {recentActivity.length} things recently
            </h3>
          </div>
          <button type="button" onClick={() => navigate("/spending")} className="text-sm font-medium" style={{ color: "var(--brand-hover)" }}>
            View all →
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No recent transactions — send Finn a receipt or type one in to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
            {recentActivity.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--gridline)" }}>
                <span
                  className="shrink-0 rounded-full"
                  style={{ width: 9, height: 9, background: colorForKey(t.category || "Other", categoryColors) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {t.description}
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {t.category} · {t.accounts?.name ?? "—"}
                  </div>
                </div>
                <span
                  className="text-sm font-medium tabular-nums shrink-0"
                  style={{ color: t.amount >= 0 ? "var(--tint-green-text)" : "var(--tint-red-text)" }}
                >
                  {formatMoney(t.converted_amount ?? t.amount, mainCurrency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
