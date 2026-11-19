"use client";

import { useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { DEFAULT_ORG_SETTINGS } from "@fieldops/shared-types";
import { orgSettingsSchema, type OrgSettingsInput } from "@fieldops/shared-validation";
import { saveOrganization, updateMyProfile } from "@/lib/data";
import { useSession } from "@/lib/session";
import { friendlyError } from "@/lib/errors";
import { Alert, Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"];
const CURRENCIES = ["INR", "USD", "AED", "SGD", "GBP"];

export default function SettingsPage() {
  const { session, refresh } = useSession();
  const [org, setOrg] = useState<OrgSettingsInput | null>(null);
  const [profile, setProfile] = useState({ fullName: "", phone: "" });
  const [orgMessage, setOrgMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const isAdmin = session?.role === "ADMIN";

  // Re-seed the forms whenever the session object changes (initial load and after refresh()),
  // adjusting state during render rather than in an effect.
  const [seededFrom, setSeededFrom] = useState<typeof session>(null);
  if (session && session !== seededFrom) {
    setSeededFrom(session);
    const settings = session.organization.settings ?? DEFAULT_ORG_SETTINGS;
    setOrg({
      name: session.organization.name,
      timezone: settings.timezone,
      currency: settings.currency,
      gpsAccuracyThresholdMeters: settings.gpsAccuracyThresholdMeters,
      // Older organizations were created with a higher limit than the rules now allow.
      photoMaxPerVisit: Math.min(settings.photoMaxPerVisit, 2),
      photoMaxBytes: settings.photoMaxBytes,
      visitReminderLeadMinutes: settings.visitReminderLeadMinutes,
      workdayStart: settings.workdayStart,
      workdayEnd: settings.workdayEnd,
    });
    setProfile({ fullName: session.profile.fullName, phone: session.profile.phone });
  }

  async function submitOrg(event: React.FormEvent) {
    event.preventDefault();
    if (!org) return;
    const parsed = orgSettingsSchema.safeParse(org);
    if (!parsed.success) {
      setOrgError(parsed.error.issues[0]?.message ?? "Check the settings.");
      return;
    }
    setSavingOrg(true);
    setOrgError(null);
    setOrgMessage(null);
    try {
      await saveOrganization(parsed.data);
      await refresh();
      setOrgMessage("Organization settings saved.");
    } catch (cause) {
      setOrgError(friendlyError(cause, "Could not save settings."));
    } finally {
      setSavingOrg(false);
    }
  }

  async function submitProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      await updateMyProfile(profile.fullName, profile.phone);
      await refresh();
      setProfileMessage("Profile updated.");
    } catch (cause) {
      setProfileError(friendlyError(cause, "Could not update your profile."));
    } finally {
      setSavingProfile(false);
    }
  }

  if (!session) return null;

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Workspace policy, capture limits and your own profile." />

      <Card className="max-w-2xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold">My profile</h2>
          <p className="text-xs text-muted">
            {session.profile.email} · {session.role} · {session.profile.employeeCode}
          </p>
        </div>
        {profileError ? <Alert>{profileError}</Alert> : null}
        {profileMessage ? <Alert tone="success">{profileMessage}</Alert> : null}
        <form onSubmit={submitProfile} className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" variant="secondary" disabled={savingProfile}>
              <Save size={16} /> {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      </Card>

      {isAdmin && org ? (
        <Card className="max-w-2xl space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Organization</h2>
            <p className="text-xs text-muted">Applies to every visit and report in this workspace.</p>
          </div>
          {orgError ? <Alert>{orgError}</Alert> : null}
          {orgMessage ? <Alert tone="success">{orgMessage}</Alert> : null}
          <form onSubmit={submitOrg} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Organization name" className="sm:col-span-2">
                <Input value={org.name} onChange={(event) => setOrg({ ...org, name: event.target.value })} />
              </Field>
              <Field label="Timezone">
                <Select value={org.timezone} onChange={(event) => setOrg({ ...org, timezone: event.target.value })}>
                  {TIMEZONES.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Currency">
                <Select value={org.currency} onChange={(event) => setOrg({ ...org, currency: event.target.value })}>
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="GPS accuracy threshold (m)" hint="Check-ins worse than this are flagged">
                <Input
                  type="number"
                  min={10}
                  max={5000}
                  value={org.gpsAccuracyThresholdMeters}
                  onChange={(event) => setOrg({ ...org, gpsAccuracyThresholdMeters: Number(event.target.value) })}
                />
              </Field>
              <Field label="Reminder lead time (minutes)">
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  value={org.visitReminderLeadMinutes}
                  onChange={(event) => setOrg({ ...org, visitReminderLeadMinutes: Number(event.target.value) })}
                />
              </Field>
              <Field label="Max photos per visit" hint="2 at most">
                <Input
                  type="number"
                  min={1}
                  max={2}
                  value={org.photoMaxPerVisit}
                  onChange={(event) => setOrg({ ...org, photoMaxPerVisit: Number(event.target.value) })}
                />
              </Field>
              <Field label="Max photo size (KB)" hint="Compressed before upload; 350 KB at most">
                <Input
                  type="number"
                  min={50}
                  max={350}
                  value={Math.round(org.photoMaxBytes / 1000)}
                  onChange={(event) => setOrg({ ...org, photoMaxBytes: Number(event.target.value) * 1000 })}
                />
              </Field>
              <Field label="Workday start">
                <Input type="time" value={org.workdayStart} onChange={(event) => setOrg({ ...org, workdayStart: event.target.value })} />
              </Field>
              <Field label="Workday end">
                <Input type="time" value={org.workdayEnd} onChange={(event) => setOrg({ ...org, workdayEnd: event.target.value })} />
              </Field>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="flex items-center gap-1 text-xs text-muted">
                <ShieldCheck size={14} /> Changes are written to the audit trail.
              </p>
              <Button type="submit" disabled={savingOrg}>
                <Save size={16} /> {savingOrg ? "Saving…" : "Save organization"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="max-w-2xl">
        <h2 className="text-sm font-semibold">Workspace access</h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Organization ID</dt>
            <dd className="font-mono text-xs">{session.organization.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Your user ID</dt>
            <dd className="font-mono text-xs">{session.uid}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Membership status</dt>
            <dd>{session.membership.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Role</dt>
            <dd>{session.role}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          Accounts are created by an administrator. Contact your admin to change your role or deactivate access.
        </p>
      </Card>
    </div>
  );
}
