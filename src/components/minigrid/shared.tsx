import type { ReportedComparisonView } from "@/services/operations/views";
import type { ClassRowView, ReportStandingView } from "@/services/minigrid/views";
import { HeadRow, Row, Table, Td, Th } from "@/components/system/Table";
import { formatMetric, formatMoney, formatNumber, formatPercent, formatSigned } from "@/components/system/format";

/* Pieces the Mini-grid portfolio and site screens both use. Presentation only. */

/** Calculated less reported, with its sign and unit, as the read model gives it. */
export function varianceText(row: ReportedComparisonView): string {
  if (row.variance === null) return "—";
  if (row.varianceUnit === "percentage_points") {
    const text = formatNumber(row.variance, 1);
    return `${row.variance > 0 && /[1-9]/.test(text) ? "+" : ""}${text} pp`;
  }
  return formatSigned({ ...row.reported, value: row.variance });
}

/** One claim that differs from the records, in a line: what was reported, what was calculated, and the difference. */
export function VarianceLine({ row }: { row: ReportedComparisonView }) {
  return (
    <li className="text-xs leading-snug text-ink-2" data-variance={row.label}>
      <span className="text-ink">{row.label}:</span> reported <span className="font-mono tabular-nums text-ink">{formatMetric(row.reported)}</span>, calculated{" "}
      <span className="font-mono tabular-nums text-ink">{formatMetric(row.calculated)}</span>{" "}
      <span className="font-mono tabular-nums text-caution-ink">({varianceText(row)})</span>
    </li>
  );
}

export function ReportStanding({ report }: { report: ReportStandingView }) {
  if (report.claims === 0) return <span className="text-ink-5">No report held for this site and period.</span>;
  return (
    <span data-report-standing>
      <span className="text-ok">{report.agree} agree</span>
      {" · "}
      <span className={report.differ > 0 ? "font-semibold text-caution" : "text-ink-4"}>{report.differ} differ</span>
      {" · "}
      <span className={report.notComparable > 0 ? "text-alert" : "text-ink-4"}>{report.notComparable} not comparable</span>
    </span>
  );
}

/** Billing and collection by customer class, largest shortfall first, as the read model orders it. */
export function ClassTable({ rows, currency, name }: { rows: ClassRowView[]; currency: string | null; name: string }) {
  return (
    <div className="overflow-x-auto">
      <Table name={name}>
        <HeadRow>
          <Th>Customer class</Th>
          <Th right>Accounts</Th>
          <Th right>Prepaid / postpaid</Th>
          <Th right>Billed</Th>
          <Th right>Collected</Th>
          <Th right>Collected, of billed</Th>
          <Th right>Not collected</Th>
        </HeadRow>
        <tbody>
          {rows.map((row) => (
            <Row key={row.customerClass} id={row.customerClass}>
              <Td>
                {row.notCollected > 0 ? <span className="mr-1 text-caution">▲</span> : null}
                {row.label}
              </Td>
              <Td figure>{formatNumber(row.accounts)}</Td>
              <Td figure>
                {formatNumber(row.prepaidAccounts)} / {formatNumber(row.postpaidAccounts)}
              </Td>
              <Td figure>{formatMoney(row.revenueBilled, currency)}</Td>
              <Td figure>{formatMoney(row.revenueCollected, currency)}</Td>
              <Td figure>{row.collectionEfficiency === null ? "not billed" : formatPercent(row.collectionEfficiency)}</Td>
              <Td figure>{formatMoney(row.notCollected, currency)}</Td>
            </Row>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export const CLASS_NOTE =
  "▲ marks a class that left money uncollected. A prepaid account pays as it buys and cannot owe, so every shortfall is a postpaid account's. \"Not collected\" is billed less collected in the month, on a cash basis; it is not the amount owed.";
