import {
  type CreditFeature,
  mapDataforseoPathToCreditFeature,
} from "@/shared/billing-credit-features";
import type { DataforseoApiCallCost } from "@/server/lib/dataforseo/envelope";

/** Whether DataForSEO billed us for a call that succeeded or one that failed. */
export type SpendOutcome = "ok" | "charged_failure";

export type SpendEntryInput = {
  billing: DataforseoApiCallCost;
  creditFeature?: CreditFeature;
  source?: string;
  projectId?: string;
  outcome?: SpendOutcome;
  /** Injectable clock for tests. */
  now?: Date;
};

export type SpendEntry = {
  path: string;
  creditFeature: CreditFeature;
  costUsd: number;
  source: string | null;
  projectId: string | null;
  outcome: SpendOutcome;
  occurredAt: string;
};

/**
 * Normalises the billing envelope every DataForSEO call already carries into a
 * storable row. Self-hosted mode has no credit ledger, so this is the only
 * record that a call cost money.
 */
export function buildSpendEntry(input: SpendEntryInput): SpendEntry {
  const path =
    input.billing.path[0] === "v3"
      ? input.billing.path
      : ["v3", ...input.billing.path];

  return {
    path: `/${path.join("/")}`,
    creditFeature:
      input.creditFeature ??
      mapDataforseoPathToCreditFeature(input.billing.path),
    costUsd: input.billing.costUsd,
    source: input.source ?? null,
    projectId: input.projectId ?? null,
    outcome: input.outcome ?? "ok",
    // Written by the app rather than left to a column default: SQLite's
    // current_timestamp is space-separated ("2026-09-01 10:00:00") while
    // Postgres emits ISO, and the history query compares this column as a
    // string. One format keeps both dialects answering the same question.
    occurredAt: (input.now ?? new Date()).toISOString(),
  };
}
