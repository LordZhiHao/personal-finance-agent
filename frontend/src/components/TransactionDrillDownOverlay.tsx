import type { KeyboardEvent, ReactNode } from "react";
import { Overlay, Table, Thead, Tbody, Tr, Th, Td } from "./ui";

export interface DrillDownColumn<T> {
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

// Shared "Overlay + Table listing the selected slice/day's rows" pattern —
// previously hand-duplicated across SpendByCategoryDonut, SpendingHeatmap, and
// DividendsByCurrencyDonut. `onRowClick` is optional: SpendByCategoryDonut and
// SpendingHeatmap pass it to open EditTransactionDialog on a row, while
// DividendsByCurrencyDonut omits it since dividend events aren't editable this
// way — omitting it renders plain, non-interactive rows.
export function TransactionDrillDownOverlay<T extends { id: string | number }>({
  title,
  subtitle,
  rows,
  columns,
  onClose,
  onRowClick,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: T[];
  columns: DrillDownColumn<T>[];
  onClose: () => void;
  onRowClick?: (row: T) => void;
}) {
  return (
    <Overlay onClose={onClose} maxHeightVh={70}>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </p>
      )}
      <Table>
        <Thead>
          {columns.map((col) => (
            <Th key={col.header} align={col.align}>
              {col.header}
            </Th>
          ))}
        </Thead>
        <Tbody>
          {rows.map((row) => (
            <Tr
              key={row.id}
              {...(onRowClick
                ? {
                    role: "button" as const,
                    tabIndex: 0,
                    onClick: () => onRowClick(row),
                    onKeyDown: (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && onRowClick(row),
                    className: "cursor-pointer hover:bg-black/[0.02]",
                  }
                : {})}
            >
              {columns.map((col) => (
                <Td key={col.header} align={col.align}>
                  {col.render(row)}
                </Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Overlay>
  );
}
