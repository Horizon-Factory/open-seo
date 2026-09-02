import process from "node:process";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  mapIdListTaskToSpendEntry,
  mergeTaskMetadata,
  type IdListTask,
} from "@/server/features/spend/backfill";
import { loadLocalEnv, parseArgs } from "./cli-utils";

loadLocalEnv();
const args = parseArgs(process.argv.slice(2));

/**
 * Backfills the dataforseo_spend table from DataForSEO's own task history.
 *
 * /v3/<section>/id_list is FREE (cost: 0) and works at a zero balance, so this
 * costs nothing to run. It recovers endpoint, cost, exact timestamp and — while
 * the task is under a month old — what the call was for. It cannot recover our
 * own attribution (source, projectId), which is never sent to DataForSEO.
 *
 * Usage: pnpm tsx scripts/dataforseo-backfill-spend.ts [--since=2026-06-05] [--apply=true]
 */
const SECTIONS = [
  "serp",
  "keywords_data",
  "dataforseo_labs",
  "backlinks",
  "on_page",
  "business_data",
  "domain_analytics",
  "merchant",
  "content_analysis",
  "app_data",
] as const;

// DataForSEO allows 10 id_list calls per minute.
const RATE_LIMIT_PAUSE_MS = 6500;
const PAGE_SIZE = 1000;
// DataForSEO keeps request metadata for one month; stay inside it.
const METADATA_WINDOW_DAYS = 28;

const sqlString = (value: string | null) =>
  value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;

async function fetchSection(
  section: string,
  apiKey: string,
  since: string,
  until: string,
  includeMetadata: boolean,
): Promise<IdListTask[]> {
  const response = await fetch(
    `https://api.dataforseo.com/v3/${section}/id_list`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          datetime_from: `${since} 00:00:00 +00:00`,
          datetime_to: until,
          limit: PAGE_SIZE,
          include_metadata: includeMetadata,
        },
      ]),
    },
  );

  const payload = (await response.json()) as {
    tasks?: {
      status_code?: number;
      status_message?: string;
      result?: unknown;
    }[];
  };
  const task = payload.tasks?.[0];
  if (task?.status_code !== 20000) {
    console.warn(`  ${section}: ${task?.status_code} ${task?.status_message}`);
    return [];
  }
  return Array.isArray(task.result) ? (task.result as IdListTask[]) : [];
}

async function main() {
  const apiKey = process.env.DATAFORSEO_API_KEY;
  if (!apiKey) {
    console.error("Missing DATAFORSEO_API_KEY.");
    process.exit(1);
  }

  // datetime_to must be in the PAST — a current timestamp is rejected. And
  // datetime_from at exactly six months back is rejected despite the docs.
  const until = new Date(Date.now() - 10 * 60_000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19)
    .concat(" +00:00");
  const since = args.since ?? "2026-06-05";
  const organizationId = args.org ?? "delegated-local-admin";

  // Metadata is retained for one month only; asking for it over a longer
  // window is rejected outright, so the subjects come from a second pass.
  const metadataSince = new Date(Date.now() - METADATA_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const metadataFrom = metadataSince > since ? metadataSince : since;

  const entries = [];
  for (const section of SECTIONS) {
    const tasks = await fetchSection(section, apiKey, since, until, false);
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_PAUSE_MS));

    if (tasks.length === 0) continue;

    const enriched = await fetchSection(
      section,
      apiKey,
      metadataFrom,
      until,
      true,
    );
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_PAUSE_MS));

    const merged = mergeTaskMetadata(tasks, enriched);
    const named = merged.filter((t) => t.metadata).length;
    console.log(`  ${section}: ${merged.length} tasks (${named} with subject)`);
    entries.push(...merged.map(mapIdListTaskToSpendEntry));
  }

  const total = entries.reduce((sum, e) => sum + e.costUsd, 0);
  console.log(
    `\n${entries.length} tasks, $${total.toFixed(4)} total, since ${since}`,
  );
  if (entries.length === 0) return;

  // ON CONFLICT on the unique task_id makes re-running a no-op rather than a
  // duplicate — this script is expected to be run more than once.
  const values = entries
    .map(
      (e) =>
        `(${sqlString(organizationId)}, ${sqlString(e.taskId)}, ${sqlString(e.path)}, ` +
        `${sqlString(e.creditFeature)}, ${e.costUsd}, ${sqlString(e.subject)}, ` +
        `NULL, ${sqlString(e.outcome)}, ${sqlString(e.occurredAt)})`,
    )
    .join(",\n");
  const sql =
    `INSERT INTO dataforseo_spend\n` +
    `  (organization_id, task_id, path, credit_feature, cost_usd, subject, source, outcome, occurred_at)\n` +
    `VALUES\n${values}\nON CONFLICT(task_id) DO NOTHING;\n`;

  const sqlFile = "/tmp/dataforseo-backfill.sql";
  writeFileSync(sqlFile, sql);
  console.log(`SQL written to ${sqlFile}`);

  if (args.apply !== "true") {
    console.log("Dry run. Re-run with --apply=true to write these rows.");
    return;
  }

  execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--local",
      `--file=${sqlFile}`,
      "-y",
    ],
    { stdio: "inherit" },
  );
  console.log("Backfill applied.");
}

await main();
