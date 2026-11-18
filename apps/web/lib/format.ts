import type { TimestampLike, VisitStatus } from "@fieldops/shared-types";

export function formatDate(value: TimestampLike | Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : value.toDate();
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: TimestampLike | Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : value.toDate();
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: TimestampLike | Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : value.toDate();
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(value: TimestampLike | Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : value.toDate();
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return `${days}d ago`;
  return formatDate(date);
}

export function toDateInput(value: TimestampLike | Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : value.toDate();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toDayInput(value: TimestampLike | Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : value.toDate();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function todayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function monthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export function isOverdue(dueDate: string): boolean {
  const due = new Date(`${dueDate}T23:59:59`);
  return due.getTime() < Date.now();
}

export const statusTone: Record<VisitStatus, string> = {
  SCHEDULED: "bg-primary/10 text-primary border-primary/20",
  IN_PROGRESS: "bg-warning-soft text-warning border-warning/30",
  SUBMITTED: "bg-primary/10 text-primary border-primary/20",
  RETURNED: "bg-danger-soft text-danger border-danger/30",
  APPROVED: "bg-success-soft text-success border-success/30",
  CANCELLED: "bg-surface text-muted border-border",
};

export function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename: string, rows: Array<Array<unknown>>): void {
  const content = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
