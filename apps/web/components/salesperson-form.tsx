"use client";

import { useState } from "react";
import { salespersonInputSchema, type SalespersonInput } from "@fieldops/shared-validation";
import { friendlyError } from "@/lib/errors";
import { Alert, Button, Field, Input } from "./ui";

const empty: SalespersonInput = {
  fullName: "",
  email: "",
  phone: "",
  employeeCode: "",
  password: "",
  role: "USER",
};

export function SalespersonForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: SalespersonInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SalespersonInput>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof SalespersonInput>(key: K, value: SalespersonInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = salespersonInputSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      await onSubmit(parsed.data);
    } catch (error) {
      setFormError(friendlyError(error, "Could not create the account."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError ? <Alert>{formError}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" error={errors.fullName} className="sm:col-span-2">
          <Input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} />
        </Field>
        <Field label="Work email" error={errors.email}>
          <Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input value={form.phone} onChange={(event) => update("phone", event.target.value)} />
        </Field>
        <Field label="Employee code" error={errors.employeeCode}>
          <Input value={form.employeeCode} onChange={(event) => update("employeeCode", event.target.value)} />
        </Field>
        <Field label="Temporary password" error={errors.password} hint="At least 8 characters with a letter and number">
          <Input
            type="text"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <Alert tone="info">
        The account is created immediately. Share the email and temporary password with the salesperson; they can
        change their contact details from the mobile app.
      </Alert>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Creating account…" : "Create salesperson"}
        </Button>
      </div>
    </form>
  );
}
