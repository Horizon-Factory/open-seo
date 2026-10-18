import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { getDataforseoSpendReport } from "@/serverFunctions/spend";
import { creditFeatureLabel } from "@/shared/billing-credit-features";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/client/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Skeleton } from "@/client/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";

const WINDOWS = [7, 30, 90] as const;

const usd = (value: number) =>
  value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
  });

const UNASSIGNED = "unassigned";
const ALL = "all";

export function SpendPage() {
  const [days, setDays] = useState<number>(30);
  const [projectId, setProjectId] = useState<string>(ALL);

  const reportQuery = useQuery({
    queryKey: ["dataforseo-spend", days, projectId],
    queryFn: () =>
      getDataforseoSpendReport({
        data: { days, projectId: projectId === ALL ? undefined : projectId },
      }),
    staleTime: 30_000,
  });

  const report = reportQuery.data;
  const summary = report?.summary;
  // Backfilled history predates project attribution, so it groups as unassigned.
  const projectName = (id: string) =>
    id === UNASSIGNED
      ? "No project"
      : (report?.projects.find((p) => p.id === id)?.name ?? id);
  const projectItems = [
    { value: ALL, label: "All projects" },
    ...(report?.projects ?? []).map((p) => ({ value: p.id, label: p.name })),
    { value: UNASSIGNED, label: "No project" },
  ];
  const maxDay = Math.max(1, ...(summary?.byDay ?? []).map((d) => d.costUsd));

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Data spend</h1>
          <p className="text-sm text-muted-foreground">
            What this deployment spent on your own DataForSEO account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={projectItems}
            value={projectId}
            onValueChange={(value) => {
              if (value != null) setProjectId(value);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-44"
              aria-label="Filter by project"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            size="sm"
            variant="outline"
            value={[String(days)]}
            onValueChange={(next) => {
              // A press on the active item empties the group; keep one window on.
              if (next[0]) setDays(Number(next[0]));
            }}
          >
            {WINDOWS.map((window) => (
              <ToggleGroupItem key={window} value={String(window)}>
                {window}d
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void reportQuery.refetch()}
            aria-label="Refresh"
          >
            <RefreshCw
              className={`size-4 ${reportQuery.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Balance left</CardDescription>
            <CardTitle className="text-2xl">
              {report?.account?.balanceUsd != null
                ? usd(report.account.balanceUsd)
                : "—"}
            </CardTitle>
            <CardDescription>
              Live from DataForSEO (free to read)
            </CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Spent in window</CardDescription>
            <CardTitle className="text-2xl">
              {summary ? usd(summary.totalUsd) : "—"}
            </CardTitle>
            <CardDescription>Recorded here, last {days} days</CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Billed but failed</CardDescription>
            <CardTitle
              className={`text-2xl ${summary && summary.wastedUsd > 0 ? "text-warning" : ""}`}
            >
              {summary ? usd(summary.wastedUsd) : "—"}
            </CardTitle>
            <CardDescription>
              Charged calls that returned nothing
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {report?.account == null && !reportQuery.isPending ? (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle />
          <AlertDescription>
            Could not read the DataForSEO account balance. History below is
            still accurate.
          </AlertDescription>
        </Alert>
      ) : null}

      {reportQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : summary && summary.byFeature.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No spend recorded yet.</EmptyTitle>
            <EmptyDescription>
              Spend is recorded from the moment this feature shipped — calls
              made before then are not shown. Run any research tool and it will
              appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : summary ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By feature</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {summary.byFeature.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>{creditFeatureLabel(row.key)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.calls} calls
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {usd(row.costUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By project</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {summary.byProject.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>{projectName(row.key)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.calls} calls
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {usd(row.costUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By day</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.byDay.map((row) => (
                  <li key={row.key} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-muted-foreground">
                      {row.key}
                    </span>
                    <span className="h-2 flex-1 rounded-full bg-muted">
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
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>For</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.recent.map((row, index) => (
                      <TableRow key={`${row.occurredAt}-${index}`}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {row.occurredAt.slice(0, 16).replace("T", " ")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {row.projectId ? projectName(row.projectId) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate font-medium">
                          {row.subject ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.path}
                          {row.outcome === "charged_failure" ? (
                            <Badge variant="warning" size="sm" className="ml-2">
                              failed
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.source ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {usd(row.costUsd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
