import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { getDataforseoSpendReport } from "@/serverFunctions/spend";
import { creditFeatureLabel } from "@/shared/billing-credit-features";

const WINDOWS = [7, 30, 90] as const;

const usd = (value: number) =>
  value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
  });

export function SpendPage() {
  const [days, setDays] = useState<number>(30);

  const reportQuery = useQuery({
    queryKey: ["dataforseo-spend", days],
    queryFn: () => getDataforseoSpendReport({ data: { days } }),
    staleTime: 30_000,
  });

  const report = reportQuery.data;
  const summary = report?.summary;
  const maxDay = Math.max(1, ...(summary?.byDay ?? []).map((d) => d.costUsd));

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Data spend</h1>
          <p className="text-sm text-base-content/60">
            What this deployment spent on your own DataForSEO account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="join">
            {WINDOWS.map((window) => (
              <button
                key={window}
                type="button"
                className={`btn join-item btn-sm ${days === window ? "btn-active" : ""}`}
                onClick={() => setDays(window)}
              >
                {window}d
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void reportQuery.refetch()}
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${reportQuery.isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="stats mb-6 w-full border border-base-300 bg-base-100 shadow-sm max-sm:stats-vertical">
        <div className="stat">
          <div className="stat-title">Balance left</div>
          <div className="stat-value text-2xl">
            {report?.account?.balanceUsd != null
              ? usd(report.account.balanceUsd)
              : "—"}
          </div>
          <div className="stat-desc">Live from DataForSEO (free to read)</div>
        </div>
        <div className="stat">
          <div className="stat-title">Spent in window</div>
          <div className="stat-value text-2xl">
            {summary ? usd(summary.totalUsd) : "—"}
          </div>
          <div className="stat-desc">Recorded here, last {days} days</div>
        </div>
        <div className="stat">
          <div className="stat-title">Billed but failed</div>
          <div
            className={`stat-value text-2xl ${summary && summary.wastedUsd > 0 ? "text-warning" : ""}`}
          >
            {summary ? usd(summary.wastedUsd) : "—"}
          </div>
          <div className="stat-desc">Charged calls that returned nothing</div>
        </div>
      </div>

      {report?.account == null && !reportQuery.isPending ? (
        <div className="alert alert-warning mb-6">
          <AlertTriangle className="h-4 w-4" />
          <span>
            Could not read the DataForSEO account balance. History below is
            still accurate.
          </span>
        </div>
      ) : null}

      {reportQuery.isPending ? (
        <div className="skeleton h-64 w-full" />
      ) : summary && summary.byFeature.length === 0 ? (
        <div className="rounded-box border border-base-300 bg-base-100 p-8 text-center">
          <p className="font-medium">No spend recorded yet.</p>
          <p className="mt-1 text-sm text-base-content/60">
            Spend is recorded from the moment this feature shipped — calls made
            before then are not shown. Run any research tool and it will appear
            here.
          </p>
        </div>
      ) : summary ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-box border border-base-300 bg-base-100 p-4">
            <h2 className="mb-3 font-medium">By feature</h2>
            <table className="table table-sm">
              <tbody>
                {summary.byFeature.map((row) => (
                  <tr key={row.key}>
                    <td>{creditFeatureLabel(row.key)}</td>
                    <td className="text-right text-base-content/60">
                      {row.calls} calls
                    </td>
                    <td className="text-right font-medium">
                      {usd(row.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-box border border-base-300 bg-base-100 p-4">
            <h2 className="mb-3 font-medium">By day</h2>
            <ul className="space-y-2">
              {summary.byDay.map((row) => (
                <li key={row.key} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-base-content/60">
                    {row.key}
                  </span>
                  <span className="h-2 flex-1 rounded-full bg-base-200">
                    <span
                      className="block h-2 rounded-full bg-primary"
                      style={{ width: `${(row.costUsd / maxDay) * 100}%` }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right font-medium">
                    {usd(row.costUsd)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-box border border-base-300 bg-base-100 p-4 lg:col-span-2">
            <h2 className="mb-3 font-medium">Recent calls</h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>For</th>
                    <th>Endpoint</th>
                    <th>Source</th>
                    <th className="text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {report.recent.map((row, index) => (
                    <tr key={`${row.occurredAt}-${index}`}>
                      <td className="whitespace-nowrap text-base-content/60">
                        {row.occurredAt.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="max-w-[16rem] truncate font-medium">
                        {row.subject ?? "—"}
                      </td>
                      <td className="font-mono text-xs">
                        {row.path}
                        {row.outcome === "charged_failure" ? (
                          <span className="badge badge-warning badge-xs ml-2">
                            failed
                          </span>
                        ) : null}
                      </td>
                      <td className="text-base-content/60">
                        {row.source ?? "—"}
                      </td>
                      <td className="text-right font-medium">
                        {usd(row.costUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
