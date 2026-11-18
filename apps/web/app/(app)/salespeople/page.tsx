"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, UserCheck, UserX } from "lucide-react";
import type { Client, UserProfile, Visit } from "@fieldops/shared-types";
import type { SalespersonInput } from "@fieldops/shared-validation";
import {
  createSalesperson,
  fetchClients,
  fetchSalespeople,
  fetchVisits,
  setSalespersonStatus,
  updateSalesperson,
} from "@/lib/data";
import { formatDate, initials } from "@/lib/format";
import { useSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { SalespersonForm } from "@/components/salesperson-form";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner } from "@/components/ui";

export default function SalespeoplePage() {
  const { session } = useSession();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string; name: string } | null>(null);
  const [detail, setDetail] = useState<UserProfile | null>(null);
  const [edit, setEdit] = useState({ fullName: "", phone: "", employeeCode: "" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [nextUsers, nextClients, nextVisits] = await Promise.all([
        fetchSalespeople(),
        fetchClients(),
        fetchVisits(),
      ]);
      setUsers(nextUsers);
      setClients(nextClients);
      setVisits(nextVisits);
      setError(null);
    } catch (cause) {
      setError(friendlyError(cause, "Could not load salespeople."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred so load's state updates run after the effect, not synchronously inside it.
    void Promise.resolve().then(load);
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) =>
      !term ? true : [user.fullName, user.email, user.employeeCode, user.phone].join(" ").toLowerCase().includes(term),
    );
  }, [users, search]);

  function openDetail(user: UserProfile) {
    setDetail(user);
    setEdit({ fullName: user.fullName, phone: user.phone, employeeCode: user.employeeCode });
    setActionError(null);
  }

  async function create(input: SalespersonInput) {
    await createSalesperson(input);
    setShowNew(false);
    setCreated({ email: input.email, password: input.password, name: input.fullName });
    await load();
  }

  async function saveEdit() {
    if (!detail) return;
    setActionError(null);
    try {
      await updateSalesperson(detail.uid, edit);
      const next = await fetchSalespeople();
      setUsers(next);
      setDetail(next.find((user) => user.uid === detail.uid) ?? null);
    } catch (cause) {
      setActionError(friendlyError(cause, "Could not save changes."));
    }
  }

  async function toggleStatus(user: UserProfile) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await setSalespersonStatus(user.uid, user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      await load();
      setDetail(null);
    } catch (cause) {
      setActionError(friendlyError(cause, "Could not update the account."));
    } finally {
      setBusy(false);
    }
  }

  const assignedClients = detail ? clients.filter((client) => client.assignedUserIds.includes(detail.uid)) : [];
  const userVisits = detail ? visits.filter((visit) => visit.userId === detail.uid) : [];

  if (session?.role !== "ADMIN") {
    return <Alert tone="warning">Only administrators can manage salespeople.</Alert>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Salespeople"
        description="Provision accounts, keep contact details current and manage field access."
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus size={16} /> Create salesperson
          </Button>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <Card className="space-y-3">
        <div className="relative max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or employee code"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm shadow-card outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/12"
          />
        </div>

        {loading ? (
          <Spinner label="Loading salespeople…" />
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Salesperson</th>
                  <th className="py-2 pr-3 font-medium">Contact</th>
                  <th className="py-2 pr-3 font-medium">Clients</th>
                  <th className="py-2 pr-3 font-medium">Visits</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((user) => {
                  const clientCount = clients.filter((client) => client.assignedUserIds.includes(user.uid)).length;
                  const visitCount = visits.filter((visit) => visit.userId === user.uid).length;
                  return (
                    <tr key={user.uid}>
                      <td className="py-2.5 pr-3">
                        <button onClick={() => openDetail(user)} className="flex items-center gap-2 text-left">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials(user.fullName)}
                          </span>
                          <span>
                            <span className="block font-medium hover:text-primary">{user.fullName}</span>
                            <span className="text-xs text-muted">{user.employeeCode}</span>
                          </span>
                        </button>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="block">{user.email}</span>
                        <span className="text-xs text-muted">{user.phone}</span>
                      </td>
                      <td className="py-2.5 pr-3">{clientCount}</td>
                      <td className="py-2.5 pr-3">{visitCount}</td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          className={
                            user.status === "ACTIVE"
                              ? "border-success/30 bg-success-soft text-success"
                              : "border-border bg-surface text-muted"
                          }
                        >
                          {user.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="secondary" onClick={() => openDetail(user)}>
                          Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No salespeople found" description="Create an account to get your field team started." />
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Create salesperson" wide>
        <SalespersonForm onSubmit={create} onCancel={() => setShowNew(false)} />
      </Modal>

      <Modal
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        title="Account created"
        description="Share these credentials securely. The password is shown only once."
        footer={<Button onClick={() => setCreated(null)}>Done</Button>}
      >
        {created ? (
          <div className="space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
            <p>
              <span className="text-muted">Name:</span> {created.name}
            </p>
            <p>
              <span className="text-muted">Email:</span> <span className="font-mono">{created.email}</span>
            </p>
            <p>
              <span className="text-muted">Temporary password:</span>{" "}
              <span className="font-mono">{created.password}</span>
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => {
          setDetail(null);
          setActionError(null);
        }}
        title={detail?.fullName ?? "Salesperson"}
        description={detail ? `${detail.email} · ${detail.employeeCode}` : undefined}
        wide
      >
        {detail ? (
          <div className="space-y-5">
            {actionError ? <Alert>{actionError}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Assigned clients</p>
                <p className="text-xl font-semibold">{assignedClients.length}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Total visits</p>
                <p className="text-xl font-semibold">{userVisits.length}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Status</p>
                <p className="text-xl font-semibold">{detail.status}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={edit.fullName} onChange={(event) => setEdit({ ...edit, fullName: event.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={edit.phone} onChange={(event) => setEdit({ ...edit, phone: event.target.value })} />
              </Field>
              <Field label="Employee code">
                <Input value={edit.employeeCode} onChange={(event) => setEdit({ ...edit, employeeCode: event.target.value })} />
              </Field>
              <Field label="Email" hint="Email changes require a new account">
                <Input value={detail.email} disabled />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={saveEdit}>
                Save profile
              </Button>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Assigned clients</p>
              {assignedClients.length ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {assignedClients.map((client) => (
                    <li key={client.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{client.name}</span>
                      <span className="text-xs text-muted">
                        {client.city}, {client.state}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No clients assigned.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Recent visits</p>
              {userVisits.length ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {userVisits.slice(0, 6).map((visit) => (
                    <li key={visit.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{visit.clientName}</span>
                      <span className="text-xs text-muted">{formatDate(visit.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No visits recorded.</p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-muted">
                {detail.status === "ACTIVE"
                  ? "Deactivating ends active assignments and blocks sign-in."
                  : "Reactivating restores sign-in; reassign clients separately."}
              </p>
              <Button variant={detail.status === "ACTIVE" ? "danger" : "success"} disabled={busy} onClick={() => toggleStatus(detail)}>
                {detail.status === "ACTIVE" ? (
                  <>
                    <UserX size={16} /> Deactivate
                  </>
                ) : (
                  <>
                    <UserCheck size={16} /> Reactivate
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
