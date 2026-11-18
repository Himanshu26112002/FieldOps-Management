"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
}) {
  const variants = {
    primary: "bg-primary text-primary-foreground shadow-card hover:brightness-110",
    secondary: "border border-border bg-card text-foreground shadow-card hover:bg-surface",
    ghost: "text-muted hover:bg-surface hover:text-foreground",
    danger: "bg-danger text-white shadow-card hover:brightness-110",
    success: "bg-success text-white shadow-card hover:brightness-110",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 ${
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm"
      } ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-card p-5 shadow-card ${className}`}>{children}</section>;
}

export function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

const control =
  "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-card outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/12 disabled:cursor-not-allowed disabled:bg-surface";

// Full width by default; a caller-supplied width class (w-48, sm:w-64, …) takes over.
function controlClass(className?: string) {
  const extra = className ?? "";
  return `${control} ${/(^|\s)(\w+:)?w-/.test(extra) ? "" : "w-full"} ${extra}`;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={controlClass(props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={controlClass(props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={controlClass(props.className)} />;
}

export function Field({
  label,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      {children}
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
      {!error && hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px] sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`my-4 w-full ${wide ? "max-w-4xl" : "max-w-lg"} overflow-hidden rounded-2xl border border-border bg-card shadow-raised`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted transition hover:bg-surface hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-border bg-surface/60 px-6 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <span className="mb-3 h-1 w-8 rounded-full bg-accent/70" aria-hidden />
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
      {label}
    </div>
  );
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "warning" | "success" | "info"; children: React.ReactNode }) {
  const tones = {
    danger: "border-danger/25 bg-danger-soft text-danger",
    warning: "border-warning/25 bg-warning-soft text-warning",
    success: "border-success/25 bg-success-soft text-success",
    info: "border-primary/20 bg-primary/8 text-primary",
  };
  return <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${tones[tone]}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const tones = {
    primary: "bg-primary/8 text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  const rails = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" };
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-card">
      <span className={`absolute inset-y-0 left-0 w-[3px] ${rails[tone]}`} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
          <p className="tabular mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        {icon ? <span className={`rounded-lg p-2.5 ${tones[tone]}`}>{icon}</span> : null}
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, tone = "bg-primary" }: { value: number; max: number; tone?: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
