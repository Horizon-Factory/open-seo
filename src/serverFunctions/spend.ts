import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSpendReport } from "@/server/features/spend/services/SpendReportService";
import type { SpendReport } from "@/server/features/spend/services/SpendReportService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

const spendReportSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
});

export const getDataforseoSpendReport = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(spendReportSchema)
  .handler(async ({ data, context }): Promise<SpendReport> => {
    return getSpendReport(context.organizationId, data.days);
  });
