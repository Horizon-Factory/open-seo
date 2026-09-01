import { describe, expect, it } from "vitest";
import { summariseSpend, type SpendRow } from "./summariseSpend";

const rows: SpendRow[] = [
  {
    occurredAt: "2026-08-30T10:00:00Z",
    creditFeature: "backlinks",
    costUsd: 0.5,
    projectId: "p1",
    outcome: "ok",
  },
  {
    occurredAt: "2026-08-30T11:00:00Z",
    creditFeature: "site_audit",
    costUsd: 2,
    projectId: "p1",
    outcome: "ok",
  },
  {
    occurredAt: "2026-08-31T09:00:00Z",
    creditFeature: "backlinks",
    costUsd: 1.5,
    projectId: "p2",
    outcome: "charged_failure",
  },
];

describe("summariseSpend", () => {
  it("totals every row it is given", () => {
    expect(summariseSpend(rows).totalUsd).toBe(4);
  });

  it("groups by feature, most expensive first", () => {
    expect(summariseSpend(rows).byFeature).toEqual([
      { key: "backlinks", costUsd: 2, calls: 2 },
      { key: "site_audit", costUsd: 2, calls: 1 },
    ]);
  });

  it("groups by calendar day so a spike is visible", () => {
    expect(summariseSpend(rows).byDay).toEqual([
      { key: "2026-08-30", costUsd: 2.5, calls: 2 },
      { key: "2026-08-31", costUsd: 1.5, calls: 1 },
    ]);
  });

  it("separates money spent on calls that were billed and still failed", () => {
    expect(summariseSpend(rows).wastedUsd).toBe(1.5);
  });

  it("returns zeroes rather than NaN for an empty history", () => {
    const empty = summariseSpend([]);
    expect(empty.totalUsd).toBe(0);
    expect(empty.wastedUsd).toBe(0);
    expect(empty.byFeature).toEqual([]);
  });
});
