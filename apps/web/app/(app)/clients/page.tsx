"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Plus, Search, UserPlus } from "lucide-react";
import type { Client, ClientAssignment, UserProfile, Visit } from "@fieldops/shared-types";
import { VISIT_STATUS_LABELS } from "@fieldops/shared-types";
import type { ClientInput } from "@fieldops/shared-validation";
import {
  assignClient,
  createClient,
  fetchAssignments,
  fetchClients,
  fetchSalespeople,
  fetchVisits,
  setClientStatus,
  unassignClient,
  updateClient,
} from "@/lib/data";
import { formatDate, statusTone } from "@/lib/format";
import { useSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { ClientForm } from "@/components/client-form";
import { Alert, Badge, Button, Card, EmptyState, Modal, PageHeader, Select, Spinner } from "@/components/ui";

export default function ClientsPage() {
  const searchParams = useSearchParams();
  const { session } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [assignments, setAssignments] = useState<ClientAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [showNew, setShowNew] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<Client | null>(null);
  const [detail, setDetail] = useState<Client | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openedFromLink = useRef<string | null>(null);

  const isAdmin = session?.role === "ADMIN";
  const uid = session?.uid;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [nextClients, nextUsers, nextVisits] = await Promise.all([
        fetchClients(isAdmin ? undefined : uid),
        isAdmin ? fetchSalespeople() : Promise.resolve([]),
        fetchVisits(isAdmin ? undefined : uid),
      ]);
      setClients(nextClients);
      setUsers(nextUsers);
      setVisits(nextVisits);
      setError(null);
    } catch (cause) {
      setError(friendlyError(cause, "Could not load clients."));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, uid]);

  useEffect(() => {
    // Deferred so load's state updates run after the effect, not synchronously inside it.
    void Promise.resolve().then(load);
  }, [load]);

  // Open the client named in ?client= (e.g. from a notification) once the list has loaded.
  useEffect(() => {
    const clientId = searchParams.get("client");
    if (!clientId || openedFromLink.current === clientId) return;
    const match = clients.find((client) => client.id === clientId);
    if (!match) return;
    openedFromLink.current = clientId;
    void Promise.resolve().then(() => setDetail(match));
  }, [searchParams, clients]);

  useEffect(() => {
    if (!detail) return;
    fetchAssignments(detail.id)
      .then(setAssignments)
      .catch(() => setAssignments([]));
  }, [detail]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesStatus = status === "ALL" || client.status === status;
      const matchesTerm =
        !term ||
        [client.name, client.contactPerson, client.city, client.phone, client.email]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [clients, search, status]);

  const assignedUsers = (client: Client) =>
    client.assignedUserIds
      .map((uid) => users.find((user) => user.uid === uid)?.fullName ?? uid)
      .join(", ") || "Unassigned";

  async function saveNew(input: ClientInput) {
    await createClient(input);
    setShowNew(false);
    await load();
  }

  async function saveEdit(input: ClientInput) {
    if (!editing) return;
    await updateClient(editing.id, input);
    setEditing(null);
    setDetail(null);
    await load();
  }

  async function doAssign() {
    if (!detail || !assignTo || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await assignClient(detail.id, assignTo);
      setAssignTo("");
      const [nextAssignments, nextClients] = await Promise.all([fetchAssignments(detail.id), fetchClients(isAdmin ? undefined : uid)]);
      setAssignments(nextAssignments);
      setClients(nextClients);
      setDetail(nextClients.find((client) => client.id === detail.id) ?? null);
    } catch (cause) {
      setActionError(friendlyError(cause, "Could not assign the client."));
    } finally {
      setBusy(false);
    }
  }

  async function doUnassign(userId: string) {
    if (!detail || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await unassignClient(detail.id, userId);
      const [nextAssignments, nextClients] = await Promise.all([fetchAssignments(detail.id), fetchClients(isAdmin ? undefined : uid)]);
      setAssignments(nextAssignments);
      setClients(nextClients);
      setDetail(nextClients.find((client) => client.id === detail.id) ?? null);
    } catch (cause) {
      setActionError(friendlyError(cause, "Could not unassign the client."));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(client: Client) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await setClientStatus(client.id, client.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      await load();
      setDetail(null);
    } catch (cause) {
      setActionError(friendlyError(cause, "Could not update the client."));
    } finally {
      setBusy(false);
    }
  }

  const clientVisits = detail ? visits.filter((visit) => visit.clientId === detail.id) : [];
  // Scoped to the open client so a previous client's assignments never show while the new ones load.
  const activeAssignments = assignments.filter(
    (assignment) => assignment.status === "ACTIVE" && assignment.clientId === detail?.id,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        description="Businesses your salespeople visit, with assignment history and recent activity."
        actions={
          isAdmin ? (
            <Button onClick={() => setShowNew(true)}>
              <Plus size={16} /> Add client
            </Button>
          ) : undefined
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
              placeholder="Search by client, contact, city or phone"
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm shadow-card outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/12"
            />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-40">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading clients…" />
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Client</th>
                  <th className="py-2 pr-3 font-medium">Contact</th>
                  <th className="py-2 pr-3 font-medium">Location</th>
                  {isAdmin ? <th className="py-2 pr-3 font-medium">Assigned to</th> : null}
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((client) => (
                  <tr key={client.id} className="align-middle">
                    <td className="py-2.5 pr-3">
                      <button onClick={() => setDetail(client)} className="text-left">
                        <span className="block font-medium hover:text-primary">{client.name}</span>
                        <span className="text-xs text-muted">{client.category}</span>
                      </button>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="block">{client.contactPerson}</span>
                      <span className="text-xs text-muted">{client.phone}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="block">{client.city}</span>
                      <span className="text-xs text-muted">{client.state}</span>
                    </td>
                    {isAdmin ? <td className="py-2.5 pr-3 text-xs">{assignedUsers(client)}</td> : null}
                    <td className="py-2.5 pr-3">
                      <Badge
                        className={
                          client.status === "ACTIVE"
                            ? "border-success/30 bg-success-soft text-success"
                            : "border-border bg-surface text-muted"
                        }
                      >
                        {client.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setDetail(client)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No clients match"
            description={clients.length ? "Try a different search or status filter." : "Add the first client to get started."}
          />
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Add client" wide>
        <ClientForm onSubmit={saveNew} onCancel={() => setShowNew(false)} />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit client" wide>
        {editing ? <ClientForm client={editing} onSubmit={saveEdit} onCancel={() => setEditing(null)} /> : null}
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => {
          setDetail(null);
          setActionError(null);
          setAssignTo("");
        }}
        title={detail?.name ?? "Client"}
        description={detail ? `${detail.contactPerson} · ${detail.phone}` : undefined}
        wide
      >
        {detail ? (
          <div className="space-y-5">
            {actionError ? <Alert>{actionError}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Address</p>
                <p className="mt-1 text-sm">{detail.addressLine1}</p>
                {detail.addressLine2 ? <p className="text-sm">{detail.addressLine2}</p> : null}
                <p className="text-sm">
                  {detail.city}, {detail.state} {detail.postalCode}
                </p>
                {detail.geo ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${detail.geo.latitude},${detail.geo.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary"
                  >
                    <MapPin size={12} /> Open map
                  </a>
                ) : null}
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Details</p>
                <p className="mt-1 text-sm">Email: {detail.email || "—"}</p>
                <p className="text-sm">Category: {detail.category}</p>
                <p className="text-sm">Status: {detail.status}</p>
                <p className="text-sm">Last visit: {formatDate(detail.lastVisitAt)}</p>
                {detail.notes ? <p className="mt-1 text-sm text-muted">{detail.notes}</p> : null}
              </div>
            </div>

            {isAdmin ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Assigned salespeople</p>
                {activeAssignments.length ? (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {activeAssignments.map((assignment) => (
                      <li key={assignment.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div>
                          <p className="text-sm">{assignment.userName}</p>
                          <p className="text-xs text-muted">Since {formatDate(assignment.assignedAt)}</p>
                        </div>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => doUnassign(assignment.userId)}>
                          Unassign
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No active assignments.</p>
                )}
                <div className="flex gap-2">
                  <Select value={assignTo} onChange={(event) => setAssignTo(event.target.value)}>
                    <option value="">Choose a salesperson…</option>
                    {users
                      .filter((user) => user.status === "ACTIVE" && !detail.assignedUserIds.includes(user.uid))
                      .map((user) => (
                        <option key={user.uid} value={user.uid}>
                          {user.fullName}
                        </option>
                      ))}
                  </Select>
                  <Button onClick={doAssign} disabled={!assignTo || busy}>
                    <UserPlus size={16} /> Assign
                  </Button>
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-sm font-semibold">Recent visits</p>
              {clientVisits.length ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {clientVisits.slice(0, 5).map((visit) => (
                    <li key={visit.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div>
                        <p className="text-sm">{visit.userName}</p>
                        <p className="text-xs text-muted">{formatDate(visit.createdAt)}</p>
                      </div>
                      <Badge className={statusTone[visit.status]}>{VISIT_STATUS_LABELS[visit.status]}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No visits recorded for this client yet.</p>
              )}
            </div>

            {isAdmin ? (
              <div className="flex justify-between gap-2 border-t border-border pt-3">
                <Button variant="secondary" onClick={() => setEditing(detail)}>
                  Edit client
                </Button>
                <Button variant={detail.status === "ACTIVE" ? "danger" : "success"} disabled={busy} onClick={() => toggleStatus(detail)}>
                  {detail.status === "ACTIVE" ? "Deactivate client" : "Reactivate client"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
