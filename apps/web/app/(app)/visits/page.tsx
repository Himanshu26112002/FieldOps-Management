"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, Clock, MapPin, RotateCcw, Search, XCircle } from "lucide-react";
import type { Client, UserProfile, Visit, VisitPhoto, VisitRevision } from "@fieldops/shared-types";
import {
  OUTCOME_LABELS,
  VISIT_STATUSES,
  VISIT_STATUS_LABELS,
} from "@fieldops/shared-types";
import { visitScheduleSchema } from "@fieldops/shared-validation";
import {
  approveVisit,
  cancelVisit,
  fetchClients,
  fetchPhotos,
  fetchRevisions,
  fetchSalespeople,
  fetchVisit,
  fetchVisits,
  returnVisit,
  scheduleVisit,
} from "@/lib/data";
import { formatDate, formatDateTime, statusTone, toDateInput } from "@/lib/format";
import { useSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";

export default function VisitsPage() {
  const searchParams = useSearchParams();
  const { session } = useSession();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "ALL");
  const [person, setPerson] = useState("ALL");
  const [showSchedule, setShowSchedule] = useState(searchParams.get("new") === "1");
  const [detail, setDetail] = useState<Visit | null>(null);
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [revisions, setRevisions] = useState<VisitRevision[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState({ clientId: "", userId: "", scheduledFor: "" });

  const isAdmin = session?.role === "ADMIN";
  const uid = session?.uid;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [nextVisits, nextClients, nextUsers] = await Promise.all([
        fetchVisits(isAdmin ? undefined : uid),
        isAdmin ? fetchClients() : Promise.resolve([]),
        isAdmin ? fetchSalespeople() : Promise.resolve([]),
      ]);
      setVisits(nextVisits);
      setClients(nextClients.filter((client) => client.status === "ACTIVE"));
      setUsers(nextUsers.filter((user) => user.status === "ACTIVE"));
      setError(null);
    } catch (cause) {
      setError(friendlyError(cause, "Could not load visits."));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, uid]);

  useEffect(() => {
    // Deferred so load's state updates run after the effect, not synchronously inside it.
    void Promise.resolve().then(load);
  }, [load]);

  const openDetail = useCallback(async (visitId: string) => {
    setActionError(null);
    setReason("");
    try {
      const visit = await fetchVisit(visitId);
      setDetail(visit);
      if (!visit) setError("That visit no longer exists.");
      if (visit) {
        const [nextPhotos, nextRevisions] = await Promise.all([fetchPhotos(visit.id), fetchRevisions(visit.id)]);
        setPhotos(nextPhotos);
        setRevisions(nextRevisions);
      }
    } catch (cause) {
      setError(friendlyError(cause, "Could not open the visit."));
    }
  }, []);

  useEffect(() => {
    const visitId = searchParams.get("visit");
    if (visitId) void Promise.resolve().then(() => openDetail(visitId));
  }, [searchParams, openDetail]);

  // Only clients assigned to the chosen salesperson can be scheduled for them.
  const scheduleClients = useMemo(
    () => (schedule.userId ? clients.filter((client) => client.assignedUserIds.includes(schedule.userId)) : []),
    [clients, schedule.userId],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return visits.filter((visit) => {
      const matchesStatus = status === "ALL" || visit.status === status;
      const matchesPerson = person === "ALL" || visit.userId === person;
      const matchesTerm =
        !term || [visit.clientName, visit.clientCity, visit.userName].join(" ").toLowerCase().includes(term);
      return matchesStatus && matchesPerson && matchesTerm;
    });
  }, [visits, search, status, person]);

  async function submitSchedule(event: React.FormEvent) {
    event.preventDefault();
    const parsed = visitScheduleSchema.safeParse(schedule);
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Check the schedule details.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const id = await scheduleVisit(parsed.data);
      setShowSchedule(false);
      setSchedule({ clientId: "", userId: "", scheduledFor: "" });
      await load();
      await openDetail(id);
    } catch (cause) {
      setActionError(friendlyError(cause, "Could not schedule the visit."));
    } finally {
      setBusy(false);
    }
  }

  async function runAction(kind: "approve" | "return" | "cancel") {
    if (!detail) return;
    setBusy(true);
    setActionError(null);
    try {
      if (kind === "approve") await approveVisit(detail, reason);
      if (kind === "return") {
        if (reason.trim().length < 5) throw new Error("Add a correction reason of at least 5 characters.");
        await returnVisit(detail, reason.trim());
      }
      if (kind === "cancel") {
        if (reason.trim().length < 3) throw new Error("Add a cancellation reason.");
        await cancelVisit(detail, reason.trim());
      }
      await load();
      const refreshed = await fetchVisit(detail.id);
      setDetail(refreshed);
      setReason("");
      if (refreshed) {
        const [nextPhotos, nextRevisions] = await Promise.all([fetchPhotos(refreshed.id), fetchRevisions(refreshed.id)]);
        setPhotos(nextPhotos);
        setRevisions(nextRevisions);
      }
    } catch (cause) {
      setActionError(friendlyError(cause, "The action failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Visits"
        description="Schedule field visits, review GPS check-ins and approve submitted reports."
        actions={
          isAdmin ? (
            <Button onClick={() => setShowSchedule(true)}>
              <CalendarPlus size={16} /> Schedule visit
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
              placeholder="Search client, city or salesperson"
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm shadow-card outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/12"
            />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-48">
            <option value="ALL">All statuses</option>
            {VISIT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {VISIT_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
          {isAdmin ? (
            <Select value={person} onChange={(event) => setPerson(event.target.value)} className="w-48">
              <option value="ALL">All salespeople</option>
              {users.map((user) => (
                <option key={user.uid} value={user.uid}>
                  {user.fullName}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        {loading ? (
          <Spinner label="Loading visits…" />
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Client</th>
                  <th className="py-2 pr-3 font-medium">Salesperson</th>
                  <th className="py-2 pr-3 font-medium">Scheduled</th>
                  <th className="py-2 pr-3 font-medium">Origin</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((visit) => (
                  <tr key={visit.id}>
                    <td className="py-2.5 pr-3">
                      <button onClick={() => void openDetail(visit.id)} className="text-left">
                        <span className="block font-medium hover:text-primary">{visit.clientName}</span>
                        <span className="text-xs text-muted">{visit.clientCity}</span>
                      </button>
                    </td>
                    <td className="py-2.5 pr-3">{visit.userName}</td>
                    <td className="py-2.5 pr-3 text-xs">{visit.scheduledFor ? formatDateTime(visit.scheduledFor) : "Ad hoc"}</td>
                    <td className="py-2.5 pr-3">
                      <Badge className="border-border bg-surface text-muted">{visit.origin === "AD_HOC" ? "Ad hoc" : "Scheduled"}</Badge>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge className={statusTone[visit.status]}>{VISIT_STATUS_LABELS[visit.status]}</Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <Button size="sm" variant="secondary" onClick={() => void openDetail(visit.id)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No visits match"
            description={visits.length ? "Try another filter." : "Schedule a visit to start tracking field activity."}
          />
        )}
      </Card>

      <Modal open={showSchedule} onClose={() => setShowSchedule(false)} title="Schedule a visit" wide>
        <form onSubmit={submitSchedule} className="space-y-4">
          {actionError ? <Alert>{actionError}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client" hint={schedule.userId && !scheduleClients.length ? "No active clients are assigned to this salesperson" : undefined}>
              <Select
                value={schedule.clientId}
                disabled={!schedule.userId}
                onChange={(event) => setSchedule({ ...schedule, clientId: event.target.value })}
              >
                <option value="">{schedule.userId ? "Choose a client…" : "Choose a salesperson first…"}</option>
                {scheduleClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} — {client.city}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Salesperson">
              <Select
                value={schedule.userId}
                onChange={(event) => {
                  const userId = event.target.value;
                  const keepClient = clients.some((client) => client.id === schedule.clientId && client.assignedUserIds.includes(userId));
                  setSchedule({ ...schedule, userId, clientId: keepClient ? schedule.clientId : "" });
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
            <Field label="Date and time" className="sm:col-span-2">
              <Input
                type="datetime-local"
                value={schedule.scheduledFor}
                min={toDateInput(new Date())}
                onChange={(event) => setSchedule({ ...schedule, scheduledFor: event.target.value })}
              />
            </Field>
          </div>
          <Alert tone="info">The salesperson receives an in-app notification and can start the visit from the mobile app.</Alert>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowSchedule(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Scheduling…" : "Schedule visit"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => {
          setDetail(null);
          setPhotos([]);
          setRevisions([]);
          setActionError(null);
        }}
        title={detail ? `${detail.clientName} — ${VISIT_STATUS_LABELS[detail.status]}` : "Visit"}
        description={detail ? `${detail.userName} · ${detail.clientCity}` : undefined}
        wide
      >
        {detail ? (
          <div className="space-y-5">
            {actionError ? <Alert>{actionError}</Alert> : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Scheduled</p>
                <p className="text-sm">{detail.scheduledFor ? formatDateTime(detail.scheduledFor) : "Ad hoc visit"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Check-in</p>
                <p className="text-sm">{formatDateTime(detail.checkIn?.capturedAt)}</p>
                {detail.checkIn ? (
                  <a
                    className="inline-flex items-center gap-1 text-xs text-primary"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps/search/?api=1&query=${detail.checkIn.latitude},${detail.checkIn.longitude}`}
                  >
                    <MapPin size={12} /> {detail.checkIn.latitude.toFixed(4)}, {detail.checkIn.longitude.toFixed(4)}
                  </a>
                ) : null}
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Check-out</p>
                <p className="text-sm">{formatDateTime(detail.checkOut?.capturedAt)}</p>
                {detail.checkOut ? (
                  <a
                    className="inline-flex items-center gap-1 text-xs text-primary"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps/search/?api=1&query=${detail.checkOut.latitude},${detail.checkOut.longitude}`}
                  >
                    <MapPin size={12} /> {detail.checkOut.latitude.toFixed(4)}, {detail.checkOut.longitude.toFixed(4)}
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="text-sm font-semibold">Visit report</p>
                <Badge className={statusTone[detail.status]}>{VISIT_STATUS_LABELS[detail.status]}</Badge>
              </div>
              {detail.report ? (
                <div className="space-y-2 p-3 text-sm">
                  <p>
                    <span className="text-muted">Outcome:</span> {OUTCOME_LABELS[detail.report.outcome]}
                  </p>
                  <p>{detail.report.summary}</p>
                  <p className="text-xs text-muted">Activities: {detail.report.activities.join(", ")}</p>
                  {detail.report.productsDiscussed ? <p className="text-xs">Products: {detail.report.productsDiscussed}</p> : null}
                  {detail.report.competitorInfo ? <p className="text-xs">Competitor: {detail.report.competitorInfo}</p> : null}
                  {detail.report.customerFeedback ? <p className="text-xs">Feedback: {detail.report.customerFeedback}</p> : null}
                  {detail.report.nextAction ? <p className="text-xs">Next action: {detail.report.nextAction}</p> : null}
                  {detail.report.followupRequired ? (
                    <p className="text-xs text-warning">Follow-up required by {formatDate(detail.report.followupDate)}</p>
                  ) : null}
                </div>
              ) : (
                <p className="p-3 text-sm text-muted">No report yet.</p>
              )}
            </div>

            {photos.length ? (
              <div>
                <p className="mb-2 text-sm font-semibold">Photos ({photos.length})</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((photo) => (
                    <figure key={photo.id} className="overflow-hidden rounded-lg border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`data:${photo.contentType};base64,${photo.data}`} alt={photo.caption || "Visit"} className="h-32 w-full object-cover" />
                      <figcaption className="px-2 py-1 text-xs text-muted">{photo.caption || "Visit photo"}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ) : null}

            {detail.returnReason ? (
              <Alert tone="danger">
                <span className="font-medium">Returned for correction:</span> {detail.returnReason}
              </Alert>
            ) : null}

            {detail.cancelReason ? (
              <Alert tone="warning">
                <span className="font-medium">Cancelled:</span> {detail.cancelReason}
              </Alert>
            ) : null}

            {revisions.length ? (
              <div>
                <p className="mb-2 text-sm font-semibold">Revision history</p>
                <ul className="space-y-2">
                  {revisions.map((revision) => (
                    <li key={revision.id} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium">Revision {revision.revisionNumber}</p>
                      <p className="text-xs text-muted">{formatDateTime(revision.createdAt)} · {revision.returnReason}</p>
                      <p className="mt-1 text-xs">{revision.newReport.summary}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {isAdmin ? (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-sm font-semibold">Administrator actions</p>
                <Textarea
                  rows={2}
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Optional approval note, or required reason for return/cancel"
                />
                <div className="flex flex-wrap gap-2">
                  {detail.status === "SUBMITTED" ? (
                    <>
                      <Button variant="success" disabled={busy} onClick={() => runAction("approve")}>
                        <CheckCircle2 size={16} /> Approve
                      </Button>
                      <Button variant="danger" disabled={busy} onClick={() => runAction("return")}>
                        <RotateCcw size={16} /> Return for correction
                      </Button>
                    </>
                  ) : null}
                  {detail.status === "SCHEDULED" || detail.status === "IN_PROGRESS" || detail.status === "RETURNED" ? (
                    <Button variant="danger" disabled={busy} onClick={() => runAction("cancel")}>
                      <XCircle size={16} /> Cancel visit
                    </Button>
                  ) : null}
                  {detail.status === "APPROVED" || detail.status === "CANCELLED" ? (
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <Clock size={14} /> No actions available for this status.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
