"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, Search, XCircle } from "lucide-react";
import type { Client, Followup, UserProfile } from "@fieldops/shared-types";
import { FOLLOWUP_STATUS_LABELS } from "@fieldops/shared-types";
import { followupInputSchema } from "@fieldops/shared-validation";
import {
  cancelFollowup,
  completeFollowup,
  createFollowup,
  fetchClients,
  fetchFollowups,
  fetchSalespeople,
} from "@/lib/data";
import { formatDate, isOverdue } from "@/lib/format";
import { useSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";

export default function FollowupsPage() {
  const { session } = useSession();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Followup | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ clientId: "", userId: "", title: "", notes: "", dueDate: "", visitId: null as string | null });

  const isAdmin = session?.role === "ADMIN";
  const uid = session?.uid;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [nextFollowups, nextClients, nextUsers] = await Promise.all([
        fetchFollowups(isAdmin ? undefined : uid),
        isAdmin ? fetchClients() : Promise.resolve([]),
        isAdmin ? fetchSalespeople() : Promise.resolve([]),
      ]);
      setFollowups(nextFollowups);
      setClients(nextClients.filter((client) => client.status === "ACTIVE"));
      setUsers(nextUsers.filter((user) => user.status === "ACTIVE"));
      setError(null);
    } catch (cause) {
      setError(friendlyError(cause, "Could not load follow-ups."));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, uid]);

  useEffect(() => {
    // Deferred so load's state updates run after the effect, not synchronously inside it.
    void Promise.resolve().then(load);
  }, [load]);

  // Only clients assigned to the chosen salesperson can carry a follow-up for them.
  const formClients = useMemo(
    () => (form.userId ? clients.filter((client) => client.assignedUserIds.includes(form.userId)) : []),
    [clients, form.userId],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return followups.filter((followup) => {
      const matchesStatus = status === "ALL" || (status === "OVERDUE" ? isOverdue(followup.dueDate) && followup.status === "OPEN" : followup.status === status);
      const matchesTerm = !term || [followup.title, followup.clientName, followup.userName].join(" ").toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [followups, search, status]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const userId = isAdmin ? form.userId : session?.uid ?? "";
    const parsed = followupInputSchema.safeParse({ ...form, userId });
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Check the follow-up details.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await createFollowup(parsed.data);
      setShowNew(false);
      setForm({ clientId: "", userId: "", title: "", notes: "", dueDate: "", visitId: null });
      await load();
    } catch (cause) {
      setActionError(friendlyError(cause, "Could not create the follow-up."));
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      await completeFollowup(selected, completionNote);
      setSelected(null);
      setCompletionNote("");
      await load();
    } catch (cause) {
      setActionError(friendlyError(cause, "Could not complete the follow-up."));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(followup: Followup) {
    setBusy(true);
    setActionError(null);
    try {
      await cancelFollowup(followup);
      setSelected(null);
      await load();
    } catch (cause) {
      setActionError(friendlyError(cause, "Could not cancel the follow-up."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Follow-ups"
        description="Keep promises to clients on track and close the loop after every visit."
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus size={16} /> New follow-up
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
              placeholder="Search follow-ups"
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm shadow-card outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/12"
            />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-40">
            <option value="ALL">All</option>
            <option value="OPEN">Open</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DONE">Done</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading follow-ups…" />
        ) : filtered.length ? (
          <ul className="divide-y divide-border">
            {filtered.map((followup) => {
              const overdue = followup.status === "OPEN" && isOverdue(followup.dueDate);
              return (
                <li key={followup.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <button onClick={() => { setSelected(followup); setCompletionNote(""); setActionError(null); }} className="min-w-0 text-left">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {overdue ? <AlertCircle size={14} className="text-danger" /> : null}
                      {followup.title}
                    </p>
                    <p className="text-xs text-muted">
                      {followup.clientName} · {followup.userName} · due {formatDate(followup.dueDate)}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        followup.status === "DONE"
                          ? "border-success/30 bg-success-soft text-success"
                          : followup.status === "CANCELLED"
                            ? "border-border bg-surface text-muted"
                            : overdue
                              ? "border-danger/30 bg-danger-soft text-danger"
                              : "border-primary/20 bg-primary/10 text-primary"
                      }
                    >
                      {overdue ? "Overdue" : FOLLOWUP_STATUS_LABELS[followup.status]}
                    </Badge>
                    {followup.status === "OPEN" ? (
                      <Button size="sm" variant="secondary" onClick={() => { setSelected(followup); setCompletionNote(""); }}>
                        Complete
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No follow-ups match" description="Create a follow-up after a visit or from a client conversation." />
        )}
      </Card>

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New follow-up"
        description="Assign the next action to a salesperson with a due date."
        wide
      >
        <form onSubmit={create} className="space-y-4">
          {actionError ? <Alert>{actionError}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client" hint={form.userId && !formClients.length ? "No active clients are assigned to this salesperson" : undefined}>
              <Select
                value={form.clientId}
                disabled={isAdmin && !form.userId}
                onChange={(event) => setForm({ ...form, clientId: event.target.value })}
              >
                <option value="">{!isAdmin || form.userId ? "Choose a client…" : "Choose a salesperson first…"}</option>
                {(isAdmin ? formClients : clients).map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </Field>
            {isAdmin ? (
              <Field label="Salesperson">
                <Select
                  value={form.userId}
                  onChange={(event) => {
                    const userId = event.target.value;
                    const keepClient = clients.some((client) => client.id === form.clientId && client.assignedUserIds.includes(userId));
                    setForm({ ...form, userId, clientId: keepClient ? form.clientId : "" });
                  }}
                >
                  <option value="">Choose a salesperson…</option>
                  {users.map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Title" className="sm:col-span-2">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Send revised quote" />
            </Field>
            <Field label="Due date">
              <Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create follow-up"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title ?? "Follow-up"}
        description={selected ? `${selected.clientName} · ${selected.userName}` : undefined}
        footer={
          selected?.status === "OPEN" ? (
            <>
              <Button variant="secondary" onClick={() => selected && cancel(selected)} disabled={busy}>
                <XCircle size={16} /> Cancel follow-up
              </Button>
              <Button variant="success" onClick={complete} disabled={busy}>
                <CheckCircle2 size={16} /> Mark complete
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
          )
        }
      >
        {selected ? (
          <div className="space-y-3">
            {actionError ? <Alert>{actionError}</Alert> : null}
            <div className="rounded-lg border border-border p-3 text-sm">
              <p>
                <span className="text-muted">Due:</span> {formatDate(selected.dueDate)}
              </p>
              <p>
                <span className="text-muted">Status:</span> {FOLLOWUP_STATUS_LABELS[selected.status]}
              </p>
              {selected.notes ? <p className="mt-1 text-muted">{selected.notes}</p> : null}
              {selected.completionNote ? <p className="mt-1 text-success">{selected.completionNote}</p> : null}
            </div>
            {selected.status === "OPEN" ? (
              <Field label="Completion note" hint="Optional summary of what happened">
                <Textarea rows={3} value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} />
              </Field>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
