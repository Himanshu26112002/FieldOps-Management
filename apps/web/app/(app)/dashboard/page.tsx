"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Users,
} from "lucide-react";
import { VISIT_STATUS_LABELS } from "@fieldops/shared-types";
import { fetchDashboard, type DashboardData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { formatDate, formatDateTime, isOverdue, statusTone } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui";

export default function DashboardPage() {
  const { session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchDashboard());
      setError(null);
    } catch (cause) {
      setError(friendlyError(cause, "Could not load the dashboard."));
    }
  }, []);

  useEffect(() => {
    // Deferred so load's state updates run after the effect, not synchronously inside it.
    void Promise.resolve().then(load);
  }, [load]);

  const isAdmin = session?.role === "ADMIN";

  if (!data) {
    return error ? <Alert>{error}</Alert> : <Spinner label="Loading dashboard…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${session?.profile.fullName.split(" ")[0]}`}
        description={isAdmin ? "A live snapshot of field activity across your organization." : "Your visits and follow-ups at a glance."}
        actions={
          isAdmin ? (
            <>
              <Link
                href="/visits?new=1"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
              >
                <CalendarDays size={16} /> Schedule visit
              </Link>
              <Link
                href="/clients?new=1"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium"
              >
                <Building2 size={16} /> Add client
              </Link>
            </>
          ) : null
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={isAdmin ? "Active clients" : "Assigned clients"} value={data.activeClients} icon={<Building2 size={20} />} />
        {isAdmin ? (
          <>
            <StatCard label="Salespeople" value={data.salespeople} tone="success" icon={<Users size={20} />} />
            <StatCard
              label="Pending approvals"
              value={data.pendingApprovals}
              hint={data.pendingApprovals ? "Visit reports waiting for review" : "Nothing waiting"}
              tone={data.pendingApprovals ? "warning" : "success"}
              icon={<ClipboardCheck size={20} />}
            />
            <StatCard label="Approved this month" value={data.approvedThisMonth} tone="success" icon={<CheckCircle2 size={20} />} />
          </>
        ) : (
          <>
            <StatCard
              label="Awaiting approval"
              value={data.pendingApprovals}
              tone={data.pendingApprovals ? "warning" : "success"}
              icon={<ClipboardCheck size={20} />}
            />
            <StatCard label="Visits scheduled today" value={data.todayVisits} icon={<CalendarDays size={20} />} />
            <StatCard
              label="Open follow-ups"
              value={data.openFollowups}
              tone={data.openFollowups ? "warning" : "success"}
              icon={<FileText size={20} />}
            />
          </>
        )}
      </div>

      {isAdmin ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Visits scheduled today" value={data.todayVisits} icon={<CalendarDays size={20} />} />
          <StatCard
            label="Open follow-ups"
            value={data.openFollowups}
            tone={data.openFollowups ? "warning" : "success"}
            icon={<FileText size={20} />}
          />
        </div>
      ) : null}

      {isAdmin ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Pending approvals</h2>
              <Link href="/visits?status=SUBMITTED" className="text-xs text-primary">
                View all
              </Link>
            </div>
            {data.pendingVisits.length ? (
              <ul className="divide-y divide-border">
                {data.pendingVisits.map((visit) => (
                  <li key={visit.id}>
                    <Link href={`/visits?visit=${visit.id}`} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{visit.clientName}</p>
                        <p className="text-xs text-muted">
                          {visit.userName} · submitted {formatDateTime(visit.submittedAt)}
                        </p>
                      </div>
                      <span className="rounded-lg bg-warning-soft px-2 py-1 text-xs font-medium text-warning">Review</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted">No visit reports are waiting for approval.</p>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Upcoming visits</h2>
              <Link href="/calendar" className="text-xs text-primary">
                Calendar
              </Link>
            </div>
            {data.upcomingVisits.length ? (
              <ul className="divide-y divide-border">
                {data.upcomingVisits.map((visit) => (
                  <li key={visit.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{visit.clientName}</p>
                      <p className="text-xs text-muted">
                        {visit.userName} · {formatDateTime(visit.scheduledFor)}
                      </p>
                    </div>
                    <Badge className={statusTone[visit.status]}>{VISIT_STATUS_LABELS[visit.status]}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted">No upcoming scheduled visits.</p>
            )}
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent visits</h2>
            <Link href="/visits" className="text-xs text-primary">
              View all
            </Link>
          </div>
          {data.recentVisits.length ? (
            <ul className="divide-y divide-border">
              {data.recentVisits.map((visit) => (
                <li key={visit.id}>
                  <Link href={`/visits?visit=${visit.id}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{visit.clientName}</p>
                      <p className="text-xs text-muted">
                        {visit.userName} · {formatDateTime(visit.createdAt)}
                      </p>
                    </div>
                    <Badge className={statusTone[visit.status]}>{VISIT_STATUS_LABELS[visit.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No visits yet" description="Schedule the first visit to see activity here." />
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Follow-ups</h2>
            <Link href="/followups" className="text-xs text-primary">
              View all
            </Link>
          </div>
          {data.dueFollowups.length ? (
            <ul className="divide-y divide-border">
              {data.dueFollowups.map((followup) => (
                <li key={followup.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{followup.title}</p>
                    <p className="text-xs text-muted">
                      {followup.clientName} · {followup.userName}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1 text-xs ${isOverdue(followup.dueDate) ? "text-danger" : "text-muted"}`}>
                    {isOverdue(followup.dueDate) ? <AlertCircle size={14} /> : null}
                    {formatDate(followup.dueDate)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted">No open follow-ups.</p>
          )}
        </Card>
      </div>

      {isAdmin ? (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <Link href="/audit" className="text-xs text-primary">
              Audit log
            </Link>
          </div>
          {data.recentAudit.length ? (
            <ul className="space-y-2">
              {data.recentAudit.map((log) => (
                <li key={log.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm">{log.summary}</p>
                    <p className="text-xs text-muted">
                      {log.actorRole} · {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <Badge className="border-border bg-surface text-muted">{log.action.replaceAll("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted">No activity recorded yet.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
