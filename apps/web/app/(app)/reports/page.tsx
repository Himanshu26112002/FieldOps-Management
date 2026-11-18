"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import type { UserProfile, Visit } from "@fieldops/shared-types";
import { VISIT_STATUS_LABELS } from "@fieldops/shared-types";
import { fetchSalespeople, fetchVisits } from "@/lib/data";
import { downloadCsv, formatDate, toDayInput } from "@/lib/format";
import { useSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { Alert, Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner } from "@/components/ui";

export default function ReportsPage() {
  const { session } = useSession();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return toDayInput(date);
  });
  const [to, setTo] = useState(() => toDayInput(new Date()));
  const [person, setPerson] = useState("ALL");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [nextVisits, nextUsers] = await Promise.all([fetchVisits(), fetchSalespeople()]);
      setVisits(nextVisits);
      setUsers(nextUsers);
      setError(null);
    } catch (cause) {
      setError(friendlyError(cause, "Could not load report data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred so load's state updates run after the effect, not synchronously inside it.
    void Promise.resolve().then(load);
  }, [load]);

  const filtered = useMemo(() => {
    const start = from ? new Date(`${from}T00:00:00`) : null;
    const end = to ? new Date(`${to}T23:59:59`) : null;
    return visits.filter((visit) => {
      const reference = visit.checkIn?.capturedAt ?? visit.createdAt;
      if (!reference) return false;
      const date = reference.toDate();
      const inRange = (!start || date >= start) && (!end || date <= end);
      const matchesPerson = person === "ALL" || visit.userId === person;
      return inRange && matchesPerson;
    });
  }, [visits, from, to, person]);

  const totals = useMemo(() => {
    const approved = filtered.filter((visit) => visit.status === "APPROVED").length;
    const submitted = filtered.filter((visit) => visit.status === "SUBMITTED").length;
    const inProgress = filtered.filter((visit) => visit.status === "IN_PROGRESS").length;
    const scheduled = filtered.filter((visit) => visit.status === "SCHEDULED").length;
    const cancelled = filtered.filter((visit) => visit.status === "CANCELLED").length;
    const followups = filtered.filter((visit) => visit.report?.followupRequired).length;
    return { total: filtered.length, approved, submitted, inProgress, scheduled, cancelled, followups };
  }, [filtered]);

  const bySalesperson = useMemo(() => {
    const map = new Map<string, { name: string; total: number; approved: number; pending: number }>();
    filtered.forEach((visit) => {
      const entry = map.get(visit.userId) ?? { name: visit.userName, total: 0, approved: 0, pending: 0 };
      entry.total += 1;
      if (visit.status === "APPROVED") entry.approved += 1;
      if (visit.status === "SUBMITTED") entry.pending += 1;
      map.set(visit.userId, entry);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filtered]);

  const byOutcome = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((visit) => {
      if (!visit.report) return;
      map.set(visit.report.outcome, (map.get(visit.report.outcome) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  function exportCsv() {
    downloadCsv(`fieldops-visits-${from}-to-${to}.csv`, [
      ["Date", "Client", "City", "Salesperson", "Status", "Outcome", "Summary", "Follow-up due"],
      ...filtered.map((visit) => [
        formatDate(visit.checkIn?.capturedAt ?? visit.createdAt),
        visit.clientName,
        visit.clientCity,
        visit.userName,
        VISIT_STATUS_LABELS[visit.status],
        visit.report?.outcome ?? "",
        visit.report?.summary ?? "",
        visit.report?.followupDate ?? "",
      ]),
    ]);
  }

  if (session?.role !== "ADMIN") {
    return <Alert tone="warning">Only administrators can view reports.</Alert>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Visit activity, approval pipeline and outcomes for a date range."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!filtered.length}>
            <Download size={16} /> Export CSV
          </Button>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <Card className="grid gap-3 sm:grid-cols-3">
        <Field label="From">
          <Input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Field label="Salesperson">
          <Select value={person} onChange={(event) => setPerson(event.target.value)}>
            <option value="ALL">All salespeople</option>
            {users.map((user) => (
              <option key={user.uid} value={user.uid}>
                {user.fullName}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {loading ? (
        <Card>
          <Spinner label="Building report…" />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Visits", value: totals.total },
              { label: "Approved", value: totals.approved },
              { label: "Awaiting approval", value: totals.submitted },
              { label: "Flagged follow-up", value: totals.followups },
            ].map((metric) => (
              <Card key={metric.label}>
                <p className="text-xs uppercase tracking-wide text-muted">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <BarChart3 size={16} /> By salesperson
              </h2>
              {bySalesperson.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 font-medium">Name</th>
                      <th className="py-2 text-right font-medium">Visits</th>
                      <th className="py-2 text-right font-medium">Approved</th>
                      <th className="py-2 text-right font-medium">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bySalesperson.map((row) => (
                      <tr key={row.name}>
                        <td className="py-2">{row.name}</td>
                        <td className="py-2 text-right">{row.total}</td>
                        <td className="py-2 text-right">{row.approved}</td>
                        <td className="py-2 text-right">{row.pending}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="No visits in range" description="Adjust the dates or salesperson filter." />
              )}
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold">Outcomes</h2>
              {byOutcome.length ? (
                <ul className="space-y-2">
                  {byOutcome.map(([outcome, count]) => (
                    <li key={outcome}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span>{outcome.replaceAll("_", " ").toLowerCase()}</span>
                        <span className="text-muted">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${Math.max(4, (count / filtered.length) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No reports in range" description="Submitted visit reports will be summarised here." />
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-xs">
                <div>
                  <p className="text-lg font-semibold">{totals.scheduled}</p>
                  <p className="text-muted">Scheduled</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{totals.inProgress}</p>
                  <p className="text-muted">In progress</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{totals.cancelled}</p>
                  <p className="text-muted">Cancelled</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
