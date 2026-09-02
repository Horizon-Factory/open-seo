import { fetchUserData } from "@/server/lib/dataforseo/appendix";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { listSpendRowsSince } from "@/server/features/spend/repositories/SpendRepository";
import {
  summariseSpend,
  type SpendRow,
  type SpendSummary,
} from "@/server/features/spend/summariseSpend";

export type SpendAccountBalance = {
  balanceUsd: number | null;
  depositedTotalUsd: number | null;
};

export type SpendProject = { id: string; name: string };

export type SpendReport = {
  sinceIso: string;
  /** Every project in the org, so the UI can label and filter by name. */
  projects: SpendProject[];
  /** Live DataForSEO account figures; null when the account could not be read. */
  account: SpendAccountBalance | null;
  summary: SpendSummary;
  recent: SpendRow[];
};

const RECENT_CALL_LIMIT = 100;

export async function getSpendReport(
  organizationId: string,
  days: number,
  projectId?: string,
): Promise<SpendReport> {
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();
  const [rows, projects] = await Promise.all([
    listSpendRowsSince(organizationId, sinceIso, projectId),
    ProjectRepository.listProjects(organizationId),
  ]);

  return {
    sinceIso,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
    })),
    account: await readAccountBalance(),
    summary: summariseSpend(rows),
    recent: rows.slice(0, RECENT_CALL_LIMIT),
  };
}

/**
 * DataForSEO's own balance, via the FREE /v3/appendix/user_data endpoint. The
 * page must still render its stored history when this fails (bad key, upstream
 * down), so a failure degrades to null rather than throwing.
 */
async function readAccountBalance(): Promise<SpendAccountBalance | null> {
  try {
    const account = await fetchUserData();
    if (!account) return null;
    return {
      balanceUsd: account.money?.balance ?? null,
      depositedTotalUsd: account.money?.total ?? null,
    };
  } catch (error) {
    console.error("[dataforseo-spend] could not read account balance", error);
    return null;
  }
}
