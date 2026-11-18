"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import type { AppNotification } from "@fieldops/shared-types";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, NOTIFICATIONS_CHANGED_EVENT } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";

function notificationHref(notification: AppNotification) {
  if (notification.entityType === "VISIT" && notification.entityId) return `/visits?visit=${notification.entityId}`;
  if (notification.entityType === "CLIENT" && notification.entityId) return `/clients?client=${notification.entityId}`;
  if (notification.entityType === "FOLLOWUP") return "/followups";
  return null;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setItems(await fetchNotifications());
      setError(null);
    } catch (cause) {
      setError(friendlyError(cause, "Could not load notifications."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred so load's state updates run after the effect, not synchronously inside it.
    void Promise.resolve().then(load);
  }, [load]);

  const visible = useMemo(() => (unreadOnly ? items.filter((item) => !item.readAt) : items), [items, unreadOnly]);
  const unreadCount = items.filter((item) => !item.readAt).length;

  async function markAll() {
    try {
      await markAllNotificationsRead(items);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      await load();
    } catch (cause) {
      setError(friendlyError(cause, "Could not mark notifications read."));
    }
  }

  async function markOne(notification: AppNotification) {
    if (notification.readAt) return;
    try {
      await markNotificationRead(notification.id);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      setItems(await fetchNotifications());
    } catch (cause) {
      setError(friendlyError(cause, "Could not mark the notification read."));
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Assignment, visit and follow-up updates addressed to you."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setUnreadOnly((value) => !value)}>
              {unreadOnly ? "Show all" : `Unread only${unreadCount ? ` (${unreadCount})` : ""}`}
            </Button>
            <Button size="sm" onClick={markAll} disabled={!unreadCount}>
              <CheckCheck size={16} /> Mark all read
            </Button>
          </>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <Card>
        {loading ? (
          <Spinner label="Loading notifications…" />
        ) : visible.length ? (
          <ul className="divide-y divide-border">
            {visible.map((notification) => {
              const href = notificationHref(notification);
              return (
                <li key={notification.id} className={`flex gap-3 py-3 ${notification.readAt ? "" : "bg-primary/[0.03]"}`}>
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${notification.readAt ? "bg-surface text-muted" : "bg-primary/10 text-primary"}`}>
                    <Bell size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm ${notification.readAt ? "font-medium" : "font-semibold"}`}>{notification.title}</p>
                      <Badge className="border-border bg-surface text-[10px] text-muted">
                        {notification.type.replaceAll("_", " ").toLowerCase()}
                      </Badge>
                      {!notification.readAt ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{notification.body}</p>
                    <p className="mt-1 text-xs text-muted">{formatDateTime(notification.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {href ? (
                      <Link href={href} onClick={() => void markOne(notification)} className="text-xs font-medium text-primary hover:underline">
                        Open
                      </Link>
                    ) : null}
                    {!notification.readAt ? (
                      <button onClick={() => void markOne(notification)} className="text-xs text-muted hover:text-foreground">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title={unreadOnly ? "No unread notifications" : "No notifications yet"}
            description={unreadOnly ? "You are all caught up." : "Assignments and visit decisions will appear here."}
          />
        )}
      </Card>
      {!unreadOnly && !loading && !visible.length ? (
        <p className="flex items-center justify-center gap-1 text-xs text-muted">
          <BellOff size={14} /> Notifications are created by administrators and your own submissions.
        </p>
      ) : null}
    </div>
  );
}
