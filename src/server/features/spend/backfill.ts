import {
  buildSpendEntry,
  type SpendEntry,
  type SpendOutcome,
} from "@/server/features/spend/spendLog";

/** A single row from DataForSEO's free `/v3/<section>/id_list` endpoint. */
export type IdListTask = {
  id: string;
  url: string;
  datetime_posted: string;
  cost: number;
  status?: number | string | null;
  metadata?: Record<string, unknown> | null;
};

export type BackfilledSpendEntry = SpendEntry & {
  taskId: string;
  subject: string | null;
};

/**
 * DataForSEO stamps `2026-08-30 18:01:57 +00:00`; the spend table stores ISO so
 * both database dialects compare identically. Converting here keeps backfilled
 * rows sortable against live ones.
 */
function toIso(datetimePosted: string): string {
  const normalised = datetimePosted.replace(" +00:00", "Z").replace(" ", "T");
  const parsed = new Date(normalised);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Unparseable datetime_posted: ${datetimePosted}`);
  }
  return parsed.toISOString();
}

/**
 * What the call was actually for. Endpoints name their subject differently —
 * keyword research uses `keyword`, backlinks/domain endpoints use `target` —
 * so try both rather than storing the whole metadata blob.
 */
function extractSubject(metadata: Record<string, unknown> | null | undefined) {
  for (const key of ["keyword", "target", "domain"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export function mapIdListTaskToSpendEntry(
  task: IdListTask,
): BackfilledSpendEntry {
  // Anything other than DataForSEO's 20000 "Ok" was billed without returning
  // a usable result.
  const outcome: SpendOutcome =
    Number(task.status) === 20000 ? "ok" : "charged_failure";

  const entry = buildSpendEntry({
    billing: { path: task.url.split("/").filter(Boolean), costUsd: task.cost },
    outcome,
    now: new Date(toIso(task.datetime_posted)),
  });

  return { ...entry, taskId: task.id, subject: extractSubject(task.metadata) };
}

/**
 * DataForSEO retains request metadata for one month only, and rejects a
 * `datetime_from` older than that outright when `include_metadata` is true.
 * So the full window is fetched WITHOUT metadata, and a second pass over the
 * last month supplies the subjects. The full window is authoritative for which
 * tasks exist; the recent pass only enriches.
 */
export function mergeTaskMetadata(
  fullWindow: IdListTask[],
  withMetadata: IdListTask[],
): IdListTask[] {
  const metadataById = new Map(
    withMetadata.map((task) => [task.id, task.metadata ?? null]),
  );

  return fullWindow.map((task) => ({
    ...task,
    metadata: metadataById.get(task.id) ?? task.metadata ?? null,
  }));
}
