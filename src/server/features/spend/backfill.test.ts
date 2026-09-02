import { describe, expect, it } from "vitest";
import { mapIdListTaskToSpendEntry, mergeTaskMetadata } from "./backfill";

describe("mapIdListTaskToSpendEntry", () => {
  it("maps a keyword task to a spend entry with its subject and exact time", () => {
    const entry = mapIdListTaskToSpendEntry({
      id: "08301801-1535-0399-0000-c8e2a8a1b1c2",
      url: "v3/dataforseo_labs/google/related_keywords/live",
      datetime_posted: "2026-08-30 18:01:57 +00:00",
      cost: 0.01944,
      status: 20000,
      metadata: { keyword: "dictaphone ia", location_code: 2250 },
    });

    expect(entry.taskId).toBe("08301801-1535-0399-0000-c8e2a8a1b1c2");
    expect(entry.path).toBe("/v3/dataforseo_labs/google/related_keywords/live");
    expect(entry.creditFeature).toBe("keyword_research");
    expect(entry.costUsd).toBe(0.01944);
    expect(entry.subject).toBe("dictaphone ia");
    expect(entry.occurredAt).toBe("2026-08-30T18:01:57.000Z");
    expect(entry.outcome).toBe("ok");
  });

  it("falls back to the target when a task has no keyword", () => {
    const entry = mapIdListTaskToSpendEntry({
      id: "t2",
      url: "v3/backlinks/summary/live",
      datetime_posted: "2026-08-31 09:15:03 +00:00",
      cost: 0.02,
      status: 20000,
      metadata: { target: "horizonfactory.fr" },
    });

    expect(entry.subject).toBe("horizonfactory.fr");
    expect(entry.creditFeature).toBe("backlinks");
  });

  it("names the audited page for a lighthouse task", () => {
    const entry = mapIdListTaskToSpendEntry({
      id: "t4",
      url: "v3/on_page/lighthouse/live/json",
      datetime_posted: "2026-08-31 09:20:00 +00:00",
      cost: 0.005,
      status: 20000,
      metadata: { url: "https://horizonfactory.fr/" },
    });

    expect(entry.subject).toBe("https://horizonfactory.fr/");
    expect(entry.creditFeature).toBe("site_audit");
  });

  it("names the first keyword for a batch task", () => {
    const entry = mapIdListTaskToSpendEntry({
      id: "t5",
      url: "v3/dataforseo_labs/google/keyword_ideas/live",
      datetime_posted: "2026-08-31 09:21:00 +00:00",
      cost: 0.03,
      status: 20000,
      metadata: { keywords: ["prise de notes ia", "dictaphone ia"] },
    });

    expect(entry.subject).toBe("prise de notes ia");
  });

  it("marks a billed task that did not succeed as a charged failure", () => {
    const entry = mapIdListTaskToSpendEntry({
      id: "t3",
      url: "v3/serp/google/organic/live/advanced",
      datetime_posted: "2026-09-01 10:38:07 +00:00",
      cost: 0.006,
      status: 40501,
      metadata: null,
    });

    expect(entry.outcome).toBe("charged_failure");
    expect(entry.subject).toBeNull();
  });
});

describe("mergeTaskMetadata", () => {
  // DataForSEO only retains request metadata for one month, and rejects any
  // datetime_from older than that when include_metadata is true. So the full
  // window is fetched without metadata and enriched from a second, recent pass.
  const older = {
    id: "old",
    url: "v3/serp/google/organic/live/advanced",
    datetime_posted: "2026-07-01 10:00:00 +00:00",
    cost: 0.006,
    status: 20000,
    metadata: null,
  };
  const recent = {
    id: "new",
    url: "v3/dataforseo_labs/google/related_keywords/live",
    datetime_posted: "2026-08-30 18:01:57 +00:00",
    cost: 0.02,
    status: 20000,
    metadata: null,
  };

  it("keeps every task from the full window", () => {
    const merged = mergeTaskMetadata([older, recent], []);
    expect(merged.map((t) => t.id)).toEqual(["old", "new"]);
  });

  it("enriches a task with metadata from the recent pass", () => {
    const merged = mergeTaskMetadata(
      [older, recent],
      [{ ...recent, metadata: { keyword: "dictaphone ia" } }],
    );

    expect(merged.find((t) => t.id === "new")?.metadata).toEqual({
      keyword: "dictaphone ia",
    });
    expect(merged.find((t) => t.id === "old")?.metadata).toBeNull();
  });

  it("does not invent tasks that the full window did not return", () => {
    const merged = mergeTaskMetadata(
      [recent],
      [{ ...older, metadata: { keyword: "ghost" } }],
    );
    expect(merged).toHaveLength(1);
  });
});
