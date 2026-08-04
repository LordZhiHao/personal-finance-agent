import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Paperclip } from "lucide-react";
import type { Account, Transaction } from "../types";
import { formatMoney } from "../lib/format";
import { groupTransactionsByDay } from "../lib/dates";
import { iconForCategory } from "../lib/categoryIcons";
import { IconBadge } from "./ui";
import { EditTransactionDialog } from "./EditTransactionDialog";
import { useTransactionReceipt } from "../hooks/api";

function ReceiptButton({ transactionId }: { transactionId: string }) {
  const receiptQuery = useTransactionReceipt(transactionId);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const result = await receiptQuery.refetch();
    if (result.data?.url) window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={receiptQuery.isFetching}
      title="View receipt"
      className="shrink-0 p-1 rounded-md hover:bg-black/[0.04]"
      style={{ color: "var(--text-muted)" }}
    >
      <Paperclip size={14} />
    </button>
  );
}

export function TransactionsList({
  transactions,
  categories,
  accounts,
  refetchKey,
}: {
  transactions: Transaction[];
  categories: string[];
  accounts: Account[];
  refetchKey: unknown[];
}) {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const days = groupTransactionsByDay(transactions);

  if (days.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No transactions in this period.</p>;
  }

  return (
    <div>
      <div className="max-h-[520px] overflow-y-auto -mx-2 px-2">
        {days.map((day) => {
          const dayCurrency = day.transactions[0].currency;
          return (
            <div key={day.date} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold rounded-md px-2 py-1"
                    style={{ background: "var(--field-bg)", color: "var(--text-primary)" }}
                  >
                    {format(parseISO(day.date), "d MMM")}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {format(parseISO(day.date), "EEEE")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium">
                  {day.income > 0 && (
                    <span style={{ color: "var(--tint-green-text)" }}>+{formatMoney(day.income, dayCurrency)}</span>
                  )}
                  {day.expense > 0 && (
                    <span style={{ color: "var(--tint-red-text)" }}>-{formatMoney(day.expense, dayCurrency)}</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                {day.transactions.map((t) => {
                  const Icon = iconForCategory(t.category);
                  return (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setEditing(t)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setEditing(t)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-black/[0.02] text-left transition-colors cursor-pointer"
                    >
                      <IconBadge icon={<Icon size={18} />} tint="neutral" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {t.description}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {t.accounts?.name ?? "—"}
                        </p>
                      </div>
                      {t.receipt_id && <ReceiptButton transactionId={t.id} />}
                      <span
                        className="text-sm font-semibold shrink-0"
                        style={{ color: t.amount < 0 ? "var(--tint-red-text)" : "var(--tint-green-text)" }}
                      >
                        {formatMoney(t.amount, t.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <EditTransactionDialog
          transaction={editing}
          onClose={() => setEditing(null)}
          categories={categories}
          accounts={accounts}
          refetchKey={refetchKey}
        />
      )}
    </div>
  );
}
