"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import type { AuditLog, UserProfile } from "@fieldops/shared-types";
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS } from "@fieldops/shared-types";
import { fetchAuditLogs, fetchUsers } from "@/lib/data";
import { downloadCsv, formatDateTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Select, Spinner } from "@/components/ui";

export default function AuditPage() {
  const { session } = useSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState("ALL");
  const [actor, setActor] = useState("ALL");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [nextLogs, nextUsers] = await Promise.all([fetchAuditLogs(), fetchUsers()]);
      setLogs(nextLogs);
      setUsers(nextUsers);
      setError(null);
    } catch (cause) {
      setError(friendlyError(cause, "Could not load the audit trail."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred so load's state updates run after the effect, not synchronously inside it.
    void Promise.resolve().then(load);
  }, [load]);

  const actorName = useCallback(
    (uid: string) => users.find((user) => user.uid === uid)?.fullName ?? uid,
    [users],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesAction = action === "ALL" || log.action === action;
      const matchesActor = actor === "ALL" || log.actorId === actor;
      const matchesTerm =
        !term ||
        [log.summary, actorName(log.actorId), log.entityType, log.entityId].join(" ").toLowerCase().includes(term);
      return matchesAction && matchesActor && matchesTerm;
    });
  }, [logs, action, actor, search, actorName]);

  function exportCsv() {
    downloadCsv("fieldops-audit.csv", [
      ["When", "Actor", "Role", "Action", "Entity", "Entity ID", "Summary"],
      ...filtered.map((log) => [
        formatDateTime(log.createdAt),
        actorName(log.actorId),
        log.actorRole,
        AUDIT_ACTION_LABELS[log.action] ?? log.action,
        log.entityType,
        log.entityId,
        log.summary,
      ]),
    ]);
  }

  if (session?.role !== "ADMIN") {
    return <Alert tone="warning">Only administrators can view the audit trail.</Alert>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit trail"
        description="Immutable record of provisioning, assignments, visit decisions and configuration changes."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!filtered.length}>
            <Download size={16} /> Export CSV
          </Button>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search summary, actor or entity"
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm shadow-card outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/12"
            />
          </div>
          <Select value={action} onChange={(event) => setAction(event.target.value)} className="w-56">
            <option value="ALL">All actions</option>
            {AUDIT_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {AUDIT_ACTION_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select value={actor} onChange={(event) => setActor(event.target.value)} className="w-48">
            <option value="ALL">All actors</option>
            {users.map((user) => (
              <option key={user.uid} value={user.uid}>
                {user.fullName}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading audit trail…" />
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Actor</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 pr-3 font-medium">Entity</th>
                  <th className="py-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-muted">{formatDateTime(log.createdAt)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="block">{actorName(log.actorId)}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted">{log.actorRole}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge className="border-border bg-surface text-muted">{AUDIT_ACTION_LABELS[log.action] ?? log.action}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted">{log.entityType}</td>
                    <td className="py-2.5">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No audit entries match" description="Actions appear here as your team works." />
        )}
      </Card>
    </div>
  );
}
