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
  subject?: string | null;
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
  subject: string | null;
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
    subject: input.subject ?? null,
    projectId: input.projectId ?? null,
    outcome: input.outcome ?? "ok",
    // Written by the app rather than left to a column default: SQLite's
    // current_timestamp is space-separated ("2026-09-01 10:00:00") while
    // Postgres emits ISO, and the history query compares this column as a
    // string. One format keeps both dialects answering the same question.
    occurredAt: (input.now ?? new Date()).toISOString(),
  };
}

/**
 * What a call was for, read straight off the request input. Endpoints name
 * their subject differently — keyword research uses `keyword`, domain and
 * backlinks endpoints use `target`/`domain`, Lighthouse uses `url`, and batch
 * lookups send a `keywords` array — so this is read generically rather than
 * threaded through every call site. Shared with the id_list backfill, whose
 * task metadata has the same shape as the request input it came from.
 */
export function extractSpendSubject(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return null;

  const read = (key: string): unknown =>
    key in input ? Reflect.get(input, key) : undefined;

  for (const key of ["keyword", "target", "domain", "url"]) {
    const value = read(key);
    if (typeof value === "string" && value.length > 0) return value;
  }

  const keywords = read("keywords");
  if (Array.isArray(keywords) && typeof keywords[0] === "string") {
    return keywords[0];
  }

  return null;
}
