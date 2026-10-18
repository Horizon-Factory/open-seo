import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { CreditFeature } from "@/shared/billing-credit-features";
import {
  DataforseoChargedTaskError,
  type DataforseoApiCallCost,
  type DataforseoApiResponse,
} from "@/server/lib/dataforseo/envelope";
import type { RecordSpendInput } from "@/server/features/spend/services/SpendService";

/**
 * Self-hosted has no credit ledger, but each call still spends real money on
 * the operator's own DataForSEO account. Record it rather than discarding the
 * cost, so a drained balance can be explained. recordDataforseoSpend never
 * throws, so awaiting it cannot fail a call the user already paid for.
 */
export async function executeAndRecordSpend<T>(
  recordDataforseoSpend: (input: RecordSpendInput) => Promise<void>,
  customer: BillingCustomerContext,
  execute: () => Promise<DataforseoApiResponse<T>>,
  creditFeature: CreditFeature | undefined,
  subject: string | null,
): Promise<T> {
  const record = async (
    billing: DataforseoApiCallCost,
    outcome?: "charged_failure",
  ) => {
    await recordDataforseoSpend({
      billing,
      creditFeature,
      subject,
      organizationId: customer.organizationId,
      projectId: customer.projectId,
      outcome,
    });
  };
  try {
    const result = await execute();
    await record(result.billing);
    return result.data;
  } catch (error) {
    // Billed-then-failed calls are the ones most worth seeing: they cost money
    // and returned nothing.
    if (error instanceof DataforseoChargedTaskError) {
      await record(error.billing, "charged_failure");
    }
    throw error;
  }
}
