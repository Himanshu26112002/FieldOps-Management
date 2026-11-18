"use client";

import { useState } from "react";
import type { Client } from "@fieldops/shared-types";
import { clientInputSchema, type ClientInput } from "@fieldops/shared-validation";
import { friendlyError } from "@/lib/errors";
import { Alert, Button, Field, Input, Textarea } from "./ui";

const empty: ClientInput = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  category: "General",
  notes: "",
  geo: null,
};

export function ClientForm({
  client,
  onSubmit,
  onCancel,
}: {
  client?: Client;
  onSubmit: (input: ClientInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ClientInput>(() =>
    client
      ? {
          name: client.name,
          contactPerson: client.contactPerson,
          phone: client.phone,
          email: client.email,
          addressLine1: client.addressLine1,
          addressLine2: client.addressLine2,
          city: client.city,
          state: client.state,
          postalCode: client.postalCode,
          category: client.category,
          notes: client.notes,
          geo: client.geo,
        }
      : empty,
  );
  // Kept as text so partial input such as "-" or "28." can be typed; parsed together on submit.
  const [latitude, setLatitude] = useState(() => (client?.geo ? String(client.geo.latitude) : ""));
  const [longitude, setLongitude] = useState(() => (client?.geo ? String(client.geo.longitude) : ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof ClientInput>(key: K, value: ClientInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function parseGeo(): { geo: ClientInput["geo"]; errors: Record<string, string> } {
    const lat = latitude.trim();
    const lng = longitude.trim();
    if (!lat && !lng) return { geo: null, errors: {} };
    if (!lat || !lng) {
      const message = "Enter both latitude and longitude";
      return { geo: null, errors: lat ? { longitude: message } : { latitude: message } };
    }
    const latValue = Number(lat);
    const lngValue = Number(lng);
    const geoErrors: Record<string, string> = {};
    if (!Number.isFinite(latValue) || latValue < -90 || latValue > 90) geoErrors.latitude = "Latitude must be between -90 and 90";
    if (!Number.isFinite(lngValue) || lngValue < -180 || lngValue > 180) geoErrors.longitude = "Longitude must be between -180 and 180";
    return { geo: { latitude: latValue, longitude: lngValue }, errors: geoErrors };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const geo = parseGeo();
    const parsed = clientInputSchema.safeParse({ ...form, geo: geo.geo });
    if (!parsed.success || Object.keys(geo.errors).length) {
      const next: Record<string, string> = { ...geo.errors };
      parsed.error?.issues.forEach((issue) => {
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
      setFormError(friendlyError(error, "Could not save the client."));
    } finally {
      setSaving(false);
    }
  }

  const error = (key: string) => errors[key];

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError ? <Alert>{formError}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client / business name" error={error("name")} className="sm:col-span-2">
          <Input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Aurora Traders" />
        </Field>
        <Field label="Contact person" error={error("contactPerson")}>
          <Input
            value={form.contactPerson}
            onChange={(event) => update("contactPerson", event.target.value)}
            placeholder="Nikhil Rao"
          />
        </Field>
        <Field label="Phone" error={error("phone")}>
          <Input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91 98765 43210" />
        </Field>
        <Field label="Email" error={error("email")} hint="Optional">
          <Input
            type="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            placeholder="buyer@example.com"
          />
        </Field>
        <Field label="Category" error={error("category")}>
          <Input value={form.category} onChange={(event) => update("category", event.target.value)} placeholder="Retail" />
        </Field>
        <Field label="Address line 1" error={error("addressLine1")} className="sm:col-span-2">
          <Input
            value={form.addressLine1}
            onChange={(event) => update("addressLine1", event.target.value)}
            placeholder="22 MG Road"
          />
        </Field>
        <Field label="Address line 2" error={error("addressLine2")}>
          <Input value={form.addressLine2} onChange={(event) => update("addressLine2", event.target.value)} />
        </Field>
        <Field label="City" error={error("city")}>
          <Input value={form.city} onChange={(event) => update("city", event.target.value)} />
        </Field>
        <Field label="State" error={error("state")}>
          <Input value={form.state} onChange={(event) => update("state", event.target.value)} />
        </Field>
        <Field label="Postal code" error={error("postalCode")}>
          <Input value={form.postalCode} onChange={(event) => update("postalCode", event.target.value)} />
        </Field>
        <Field label="Latitude" hint="Optional map pin" error={error("latitude") ?? error("geo")}>
          <Input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="28.6139" />
        </Field>
        <Field label="Longitude" hint="Optional map pin" error={error("longitude")}>
          <Input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="77.2090" />
        </Field>
      </div>
      <Field label="Notes" error={error("notes")}>
        <Textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : client ? "Save changes" : "Create client"}
        </Button>
      </div>
    </form>
  );
}
