import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertSpendEntryMock } = vi.hoisted(() => ({
  insertSpendEntryMock: vi.fn(),
}));

vi.mock("@/server/features/spend/repositories/SpendRepository", () => ({
  insertSpendEntry: insertSpendEntryMock,
}));

import { recordDataforseoSpend } from "./SpendService";

describe("recordDataforseoSpend", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    insertSpendEntryMock.mockResolvedValue(undefined);
  });

  it("stores the normalised entry for the calling organization", async () => {
    await recordDataforseoSpend({
      billing: { path: ["v3", "backlinks", "summary", "live"], costUsd: 0.05 },
      organizationId: "org_123",
      source: "get_backlinks_overview",
    });

    expect(insertSpendEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_123",
        path: "/v3/backlinks/summary/live",
        creditFeature: "backlinks",
        costUsd: 0.05,
        source: "get_backlinks_overview",
        outcome: "ok",
      }),
    );
  });

  it("never throws when the write fails, so a logging fault cannot break a paid call", async () => {
    insertSpendEntryMock.mockRejectedValue(new Error("database is locked"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      recordDataforseoSpend({
        billing: {
          path: ["v3", "serp", "google", "organic", "live"],
          costUsd: 0.02,
        },
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      "[dataforseo-spend] failed to record spend",
      expect.any(Error),
    );
  });
});
