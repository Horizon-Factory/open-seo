import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSpendReport } from "@/server/features/spend/services/SpendReportService";
import type { SpendReport } from "@/server/features/spend/services/SpendReportService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

const spendReportSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
  // A project id, or "unassigned" for spend with no project recorded.
  projectId: z.string().min(1).optional(),
});

export const getDataforseoSpendReport = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(spendReportSchema)
  .handler(async ({ data, context }): Promise<SpendReport> => {
    return getSpendReport(context.organizationId, data.days, data.projectId);
  });
