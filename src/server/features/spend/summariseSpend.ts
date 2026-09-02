export type SpendRow = {
  occurredAt: string;
  creditFeature: string;
  costUsd: number;
  projectId: string | null;
  outcome: string;
  path?: string;
  subject?: string | null;
  source?: string | null;
};

export type SpendGroup = { key: string; costUsd: number; calls: number };

/** Grouping key for spend with no project recorded (all backfilled history). */
export const UNASSIGNED_PROJECT = "unassigned";

export type SpendSummary = {
  totalUsd: number;
  /** Spend on calls DataForSEO billed and that then failed — money for nothing. */
  wastedUsd: number;
  byFeature: SpendGroup[];
  byDay: SpendGroup[];
  byProject: SpendGroup[];
};

/** Cost sums are floats; round to the cent DataForSEO bills in. */
const round = (value: number) => Math.round(value * 1e6) / 1e6;

function group(
  rows: SpendRow[],
  keyOf: (row: SpendRow) => string,
): SpendGroup[] {
  const totals = new Map<string, SpendGroup>();
  for (const row of rows) {
    const key = keyOf(row);
    const current = totals.get(key) ?? { key, costUsd: 0, calls: 0 };
    current.costUsd = round(current.costUsd + row.costUsd);
    current.calls += 1;
    totals.set(key, current);
  }
  return [...totals.values()];
}

const byCostThenKey = (a: SpendGroup, b: SpendGroup) =>
  b.costUsd - a.costUsd || a.key.localeCompare(b.key);

export function summariseSpend(rows: SpendRow[]): SpendSummary {
  return {
    totalUsd: round(rows.reduce((sum, row) => sum + row.costUsd, 0)),
    wastedUsd: round(
      rows
        .filter((row) => row.outcome === "charged_failure")
        .reduce((sum, row) => sum + row.costUsd, 0),
    ),
    byFeature: group(rows, (row) => row.creditFeature).toSorted(byCostThenKey),
    // Chronological, so a spend spike reads as a timeline rather than a ranking.
    byDay: group(rows, (row) => row.occurredAt.slice(0, 10)).toSorted((a, b) =>
      a.key.localeCompare(b.key),
    ),
    byProject: group(
      rows,
      (row) => row.projectId ?? UNASSIGNED_PROJECT,
    ).toSorted(byCostThenKey),
  };
}
