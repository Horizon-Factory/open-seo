import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { UNASSIGNED_PROJECT } from "@/server/features/spend/summariseSpend";
import { db } from "@/db";
import { dataforseoSpend } from "@/db/schema";
import type { SpendEntry } from "@/server/features/spend/spendLog";
import type { SpendRow } from "@/server/features/spend/summariseSpend";

export type StoredSpendEntry = SpendEntry & {
  organizationId: string | null;
  taskId?: string | null;
};

export async function insertSpendEntry(entry: StoredSpendEntry): Promise<void> {
  await db.insert(dataforseoSpend).values({
    organizationId: entry.organizationId,
    projectId: entry.projectId,
    taskId: entry.taskId ?? null,
    path: entry.path,
    creditFeature: entry.creditFeature,
    costUsd: entry.costUsd,
    subject: entry.subject,
    source: entry.source,
    outcome: entry.outcome,
    occurredAt: entry.occurredAt,
  });
}

/**
 * Raw spend rows since a cutoff. Aggregation happens in `summariseSpend` rather
 * than SQL so it stays dialect-agnostic and unit-testable.
 */
export async function listSpendRowsSince(
  organizationId: string,
  sinceIso: string,
  /** "unassigned" selects rows no project was recorded for. */
  projectId?: string,
): Promise<SpendRow[]> {
  const rows = await db
    .select({
      occurredAt: dataforseoSpend.occurredAt,
      creditFeature: dataforseoSpend.creditFeature,
      costUsd: dataforseoSpend.costUsd,
      subject: dataforseoSpend.subject,
      projectId: dataforseoSpend.projectId,
      outcome: dataforseoSpend.outcome,
      path: dataforseoSpend.path,
      source: dataforseoSpend.source,
    })
    .from(dataforseoSpend)
    .where(
      and(
        eq(dataforseoSpend.organizationId, organizationId),
        gte(dataforseoSpend.occurredAt, sinceIso),
        projectId === undefined
          ? undefined
          : projectId === UNASSIGNED_PROJECT
            ? isNull(dataforseoSpend.projectId)
            : eq(dataforseoSpend.projectId, projectId),
      ),
    )
    .orderBy(desc(dataforseoSpend.occurredAt));

  return rows;
}
