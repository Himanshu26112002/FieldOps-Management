import type { TimestampLike } from "@fieldops/shared-types";

function toDate(value: TimestampLike | Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof (value as TimestampLike).toDate === "function") return (value as TimestampLike).toDate();
  const seconds = (value as { seconds?: number }).seconds;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

export function formatDate(value: TimestampLike | Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export function formatDateTime(value: TimestampLike | Date | string | null | undefined): string {
  const date = toDate(value);
  return date
    ? date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";
}

export function formatTime(value: TimestampLike | Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
}

export function toDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateTimeInput(value: string): Date | null {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isOverdue(date: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00`) < today;
}
