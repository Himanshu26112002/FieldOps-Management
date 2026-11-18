"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Visit } from "@fieldops/shared-types";
import { VISIT_STATUS_LABELS } from "@fieldops/shared-types";
import { fetchVisits } from "@/lib/data";
import { formatTime, statusTone } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { Alert, Badge, Button, Card, PageHeader, Spinner } from "@/components/ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const { session } = useSession();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setVisits(await fetchVisits(session?.role === "USER" ? session.uid : undefined));
      setError(null);
    } catch (cause) {
      setError(friendlyError(cause, "Could not load the calendar."));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    // Deferred so load's state updates run after the effect, not synchronously inside it.
    void Promise.resolve().then(load);
  }, [load]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<Date | null> = Array.from({ length: startWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Visit[]>();
    visits
      .filter((visit) => visit.scheduledFor)
      .forEach((visit) => {
        const date = visit.scheduledFor!.toDate();
        const key = date.toDateString();
        map.set(key, [...(map.get(key) ?? []), visit]);
      });
    return map;
  }, [visits]);

  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        description="Scheduled field visits by day."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft size={16} /> Prev
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              Next <ChevronRight size={16} />
            </Button>
          </>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{monthLabel}</h2>
          {loading ? <span className="text-xs text-muted">Loading…</span> : null}
        </div>
        {loading ? (
          <Spinner label="Loading calendar…" />
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-7 gap-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className="pb-2 text-center text-xs font-medium uppercase tracking-wide text-muted">
                  {day}
                </div>
              ))}
              {days.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="min-h-24 rounded-lg bg-surface/40" />;
                const dayVisits = byDay.get(day.toDateString()) ?? [];
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-24 rounded-lg border p-1.5 ${isToday ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <p className={`mb-1 text-xs font-medium ${isToday ? "text-primary" : "text-muted"}`}>{day.getDate()}</p>
                    <div className="space-y-1">
                      {dayVisits.slice(0, 3).map((visit) => (
                        <Link
                          key={visit.id}
                          href={`/visits?visit=${visit.id}`}
                          className={`block truncate rounded px-1 py-0.5 text-[10px] ${statusTone[visit.status]}`}
                          title={`${visit.clientName} · ${visit.userName} · ${VISIT_STATUS_LABELS[visit.status]}`}
                        >
                          {formatTime(visit.scheduledFor)} {visit.clientName}
                        </Link>
                      ))}
                      {dayVisits.length > 3 ? <p className="text-[10px] text-muted">+{dayVisits.length - 3} more</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "APPROVED"] as const).map((status) => (
            <Badge key={status} className={statusTone[status]}>
              {VISIT_STATUS_LABELS[status]}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
