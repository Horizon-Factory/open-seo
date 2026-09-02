import { describe, expect, it } from "vitest";
import { buildSpendEntry, extractSpendSubject } from "./spendLog";

describe("buildSpendEntry", () => {
  it("derives the credit feature from the DataForSEO path when none is given", () => {
    const entry = buildSpendEntry({
      billing: { path: ["v3", "backlinks", "summary", "live"], costUsd: 0.05 },
    });

    expect(entry.creditFeature).toBe("backlinks");
    expect(entry.path).toBe("/v3/backlinks/summary/live");
    expect(entry.costUsd).toBe(0.05);
  });

  it("normalises a path that omits the v3 prefix so grouping stays consistent", () => {
    const entry = buildSpendEntry({
      billing: { path: ["backlinks", "summary"], costUsd: 0.01 },
    });

    expect(entry.path).toBe("/v3/backlinks/summary");
  });

  it("prefers an explicit credit feature over the one derived from the path", () => {
    const entry = buildSpendEntry({
      billing: {
        path: ["v3", "dataforseo_labs", "google", "keyword_overview"],
        costUsd: 0.01,
      },
      creditFeature: "keyword_research",
    });

    expect(entry.creditFeature).toBe("keyword_research");
  });

  it("records a billed call that failed as a charged failure", () => {
    const entry = buildSpendEntry({
      billing: {
        path: ["v3", "serp", "google", "organic", "live"],
        costUsd: 0.02,
      },
      outcome: "charged_failure",
      source: "get_serp_results",
      projectId: "proj_1",
    });

    expect(entry.outcome).toBe("charged_failure");
    expect(entry.source).toBe("get_serp_results");
    expect(entry.projectId).toBe("proj_1");
  });

  // SQLite's current_timestamp default renders "2026-09-01 10:00:00" while
  // Postgres renders ISO. The history query compares occurredAt as a string, so
  // a space-separated stamp sorts below every ISO cutoff and would silently
  // return nothing on SQLite. The timestamp is therefore set here, not by the DB.
  it("stamps an ISO timestamp so both database dialects compare equal", () => {
    const entry = buildSpendEntry({
      billing: { path: ["v3", "serp"], costUsd: 0.01 },
      now: new Date("2026-09-01T10:00:00.000Z"),
    });

    expect(entry.occurredAt).toBe("2026-09-01T10:00:00.000Z");
  });
});

describe("extractSpendSubject", () => {
  it("names the keyword a research call was for", () => {
    expect(extractSpendSubject({ keyword: "agence web" })).toBe("agence web");
  });

  it("names the target a domain or backlinks call was for", () => {
    expect(extractSpendSubject({ target: "horizonfactory.fr" })).toBe(
      "horizonfactory.fr",
    );
  });

  it("uses the first keyword when a call sends a batch", () => {
    expect(extractSpendSubject({ keywords: ["seo audit", "seo tools"] })).toBe(
      "seo audit",
    );
  });

  it("returns null when the input names no subject", () => {
    expect(extractSpendSubject({ limit: 10 })).toBeNull();
  });

  it("names the audited page for endpoints whose subject is a url", () => {
    expect(extractSpendSubject({ url: "https://horizonfactory.fr/a" })).toBe(
      "https://horizonfactory.fr/a",
    );
  });
});
