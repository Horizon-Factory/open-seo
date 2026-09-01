import { insertSpendEntry } from "@/server/features/spend/repositories/SpendRepository";
import {
  buildSpendEntry,
  type SpendEntryInput,
} from "@/server/features/spend/spendLog";

export type RecordSpendInput = SpendEntryInput & { organizationId?: string };

/**
 * Persists what a DataForSEO call cost, and logs it.
 *
 * Deliberately swallows every failure: this runs on the hot path of a call the
 * user has already paid for, so a bookkeeping fault must never turn a
 * successful lookup into an error.
 */
export async function recordDataforseoSpend(
  input: RecordSpendInput,
): Promise<void> {
  try {
    const entry = buildSpendEntry(input);
    await insertSpendEntry({
      ...entry,
      organizationId: input.organizationId ?? null,
    });
    console.log(
      `[dataforseo-spend] ${entry.outcome} ${entry.path} feature=${entry.creditFeature} cost=$${entry.costUsd.toFixed(4)}${
        entry.source ? ` source=${entry.source}` : ""
      }`,
    );
  } catch (error) {
    console.error("[dataforseo-spend] failed to record spend", error);
  }
}
