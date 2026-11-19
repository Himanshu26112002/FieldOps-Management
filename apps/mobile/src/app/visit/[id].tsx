import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import { confirmAction } from "@/lib/dialogs";
import type { Visit, VisitOutcome, VisitPhoto, VisitReport } from "@fieldops/shared-types";
import { OUTCOME_LABELS, VISIT_OUTCOMES, VISIT_STATUS_LABELS } from "@fieldops/shared-types";
import { visitReportSchema } from "@fieldops/shared-validation";
import { addVisitPhoto, cancelOwnVisit, fetchVisit, fetchVisitPhotos, removeVisitPhoto, saveDraft, startScheduledVisit, submitVisit } from "@/lib/data";
import { captureGps } from "@/lib/location";
import { ensureOnline, errorCode } from "@/lib/network";
import { MAX_PHOTOS_PER_VISIT, pickCompressedPhoto, takeCompressedPhoto, type PhotoResult } from "@/lib/photos";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { SessionGate } from "@/components/session-gate";
import { Badge, Button, Card, ErrorText, HEADER_EDGES, Heading, Input, Muted, Row, Screen, Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/colors";

const emptyReport: VisitReport = { summary: "", outcome: "INFORMATION_ONLY", activities: [], productsDiscussed: "", competitorInfo: "", customerFeedback: "", nextAction: "", followupRequired: false, followupDate: null };

export default function VisitRoute() {
  return <SessionGate><VisitScreen /></SessionGate>;
}

function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [report, setReport] = useState<VisitReport>(emptyReport);
  const [activitiesText, setActivitiesText] = useState("");
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadPhotos = useCallback(async () => {
    if (!session || !id) return;
    try {
      setPhotos(await fetchVisitPhotos(id, session.organization.id));
      setPhotoError(null);
    } catch (cause) { setPhotoError(cause instanceof Error ? cause.message : "Could not load photos."); }
  }, [id, session]);

  const load = useCallback(async () => {
    if (!session || !id) return;
    try {
      const result = await fetchVisit(id, session.organization.id);
      if (!result || result.userId !== session.uid) throw new Error("Visit not found or you do not have access.");
      setVisit(result);
      const next = result.report ?? emptyReport;
      setReport(next);
      setActivitiesText(next.activities.join(", "));
      setError(null);
      await loadPhotos();
    } catch (cause) {
      // Another salesperson's visit is denied by the rules; do not show the raw Firestore message.
      setError(errorCode(cause).endsWith("permission-denied")
        ? "Visit not found or you do not have access."
        : cause instanceof Error ? cause.message : "Could not load this visit.");
    } finally { setLoading(false); }
  }, [id, session, loadPhotos]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function checkIn() {
    if (!visit || !session) return;
    setBusy(true); setError(null);
    try {
      await ensureOnline();
      const gps = await captureGps();
      await startScheduledVisit(visit, gps);
      await load();
      setMessage("Checked in. Complete the visit report when you are ready.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not check in."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!visit || !session) return;
    const candidate = { ...report, activities: activitiesText.split(",").map((item) => item.trim()).filter(Boolean) };
    const parsed = visitReportSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the report fields."); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      await saveDraft(visit.id, session.organization.id, parsed.data);
      setReport(parsed.data); setActivitiesText(parsed.data.activities.join(", "));
      setMessage("Draft saved."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the report."); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!visit || !session) return;
    const candidate = { ...report, activities: activitiesText.split(",").map((item) => item.trim()).filter(Boolean) };
    const parsed = visitReportSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the report fields."); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      await ensureOnline();
      // A resubmission keeps the original check-out, so it does not need a new GPS fix.
      const gps = visit.status === "RETURNED" ? null : await captureGps();
      const result = await submitVisit({ visit, orgId: session.organization.id, report: parsed.data, gps });
      await load();
      setMessage(result.followupSkipped
        ? "Visit submitted for review. The follow-up was not created because this client is no longer active or assigned to you."
        : "Visit submitted for review.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit the visit."); }
    finally { setBusy(false); }
  }

  async function addPhoto(source: () => Promise<PhotoResult | null>) {
    if (!visit || !session) return;
    setPhotoBusy(true); setPhotoError(null);
    try {
      await ensureOnline();
      const photo = await source();
      if (!photo) return;
      await addVisitPhoto({ visitId: visit.id, orgId: session.organization.id, base64: photo.base64, sizeBytes: photo.sizeBytes, caption: "", currentPhotoCount: Math.max(photos.length, visit.photoCount), existingPhotoIds: photos.map((item) => item.id) });
      await load();
    } catch (cause) { setPhotoError(cause instanceof Error ? cause.message : "Could not add the photo."); }
    finally { setPhotoBusy(false); }
  }

  async function confirmRemovePhoto(photo: VisitPhoto) {
    if (await confirmAction("Remove photo", "Remove this photo from the visit?", "Remove", true)) await removePhoto(photo);
  }

  async function removePhoto(photo: VisitPhoto) {
    if (!visit || !session) return;
    setPhotoBusy(true); setPhotoError(null);
    try {
      await removeVisitPhoto({ visitId: visit.id, orgId: session.organization.id, photoId: photo.id });
      await load();
    } catch (cause) { setPhotoError(cause instanceof Error ? cause.message : "Could not remove the photo."); }
    finally { setPhotoBusy(false); }
  }

  async function cancelVisit() {
    if (!visit || !session) return;
    if (cancelReason.trim().length < 3) { setError("Enter a cancellation reason of at least 3 characters."); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      await cancelOwnVisit(visit, session.organization.id, cancelReason);
      setCancelOpen(false); setCancelReason("");
      await load();
      setMessage("Visit cancelled.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not cancel the visit."); }
    finally { setBusy(false); }
  }

  function update<K extends keyof VisitReport>(key: K, value: VisitReport[K]) { setReport((current) => ({ ...current, [key]: value })); }

  if (loading) return <Screen edges={HEADER_EDGES}><Muted>Loading visit…</Muted></Screen>;
  if (!visit) return <Screen edges={HEADER_EDGES}><Heading>Visit unavailable</Heading>{error ? <ErrorText>{error}</ErrorText> : null}<Button title="Back to visits" onPress={() => router.back()} /></Screen>;
  const editable = visit.status === "IN_PROGRESS" || visit.status === "RETURNED";
  const canCancel = (visit.status === "SCHEDULED" && visit.scheduledBy === session?.uid) || (visit.status === "IN_PROGRESS" && visit.origin === "AD_HOC");
  const photoTotal = Math.max(photos.length, visit.photoCount);
  return <Screen edges={HEADER_EDGES}>
    <Heading>{visit.clientName}</Heading>
    <Muted>{visit.clientAddress}, {visit.clientCity}</Muted>
    <Card style={styles.form}><View style={styles.row}><Badge label={VISIT_STATUS_LABELS[visit.status]} tone={visit.status === "RETURNED" ? "danger" : visit.status === "APPROVED" ? "success" : "primary"} /><Muted>{visit.origin === "SCHEDULED" ? formatDateTime(visit.scheduledFor) : "Ad hoc visit"}</Muted></View>
      {visit.status === "SCHEDULED" ? <Button title="Check in" onPress={() => void checkIn()} loading={busy} disabled={busy} /> : null}
      {visit.status === "RETURNED" ? <ErrorText>Corrections requested: {visit.returnReason}</ErrorText> : null}
      {visit.status === "CANCELLED" && visit.cancelReason ? <Muted>Cancelled: {visit.cancelReason}</Muted> : null}
      {visit.status === "SUBMITTED" || visit.status === "APPROVED" || visit.status === "CANCELLED" ? <Muted>This visit is read-only.</Muted> : null}
      {canCancel && !cancelOpen ? <Button title="Cancel visit" variant="danger" onPress={() => { setCancelOpen(true); setError(null); }} disabled={busy} /> : null}
      {canCancel && cancelOpen ? <>
        <Muted>Reason for cancelling (at least 3 characters)</Muted>
        <Input value={cancelReason} onChangeText={setCancelReason} placeholder="e.g. Client rescheduled" maxLength={1000} multiline accessibilityLabel="Cancellation reason" />
        <Row><View style={{ flex: 1 }}><Button title="Keep visit" variant="secondary" onPress={() => { setCancelOpen(false); setCancelReason(""); }} disabled={busy} /></View><View style={{ flex: 1 }}><Button title="Confirm cancel" variant="danger" onPress={() => void cancelVisit()} loading={busy} disabled={busy || cancelReason.trim().length < 3} /></View></Row>
      </> : null}
      {!editable && message ? <Text style={{ color: colors.success }}>{message}</Text> : null}
    </Card>
    {editable || photos.length ? <Card style={styles.form}>
      <Heading>Photos ({photoTotal}/{MAX_PHOTOS_PER_VISIT})</Heading>
      {photos.length ? <View style={styles.photos}>{photos.map((photo) => <View key={photo.id} style={styles.photoItem}>
        <Image source={{ uri: `data:image/jpeg;base64,${photo.data}` }} style={styles.photo} contentFit="cover" accessibilityLabel="Visit photo" />
        {editable ? <Pressable onPress={() => confirmRemovePhoto(photo)} disabled={photoBusy} accessibilityRole="button"><Text style={styles.remove}>Remove</Text></Pressable> : null}
      </View>)}</View> : <Muted>No photos yet.</Muted>}
      {photoError ? <ErrorText>{photoError}</ErrorText> : null}
      {editable ? <Row><View style={{ flex: 1 }}><Button title="Take photo" variant="secondary" onPress={() => void addPhoto(takeCompressedPhoto)} loading={photoBusy} disabled={photoBusy || photoTotal >= MAX_PHOTOS_PER_VISIT} /></View><View style={{ flex: 1 }}><Button title="Choose from library" variant="secondary" onPress={() => void addPhoto(pickCompressedPhoto)} disabled={photoBusy || photoTotal >= MAX_PHOTOS_PER_VISIT} /></View></Row> : null}
    </Card> : null}
    {editable ? <Card style={styles.form}>
      <Heading>Visit report</Heading>
      <Muted>Summary (at least 10 characters)</Muted><Input value={report.summary} onChangeText={(value) => update("summary", value)} multiline accessibilityLabel="Visit summary" />
      <Muted>Outcome</Muted><View style={styles.options}>{VISIT_OUTCOMES.map((outcome: VisitOutcome) => <Pressable key={outcome} onPress={() => update("outcome", outcome)} style={[styles.option, report.outcome === outcome && styles.selected]}><Text style={{ color: report.outcome === outcome ? "#fff" : colors.text, fontSize: 12 }}>{OUTCOME_LABELS[outcome]}</Text></Pressable>)}</View>
      <Muted>Activities (comma separated)</Muted><Input value={activitiesText} onChangeText={setActivitiesText} placeholder="Product demo, price discussion" accessibilityLabel="Activities" />
      <Muted>Products discussed</Muted><Input value={report.productsDiscussed} onChangeText={(value) => update("productsDiscussed", value)} accessibilityLabel="Products discussed" />
      <Muted>Customer feedback</Muted><Input value={report.customerFeedback} onChangeText={(value) => update("customerFeedback", value)} accessibilityLabel="Customer feedback" />
      <Muted>Competitor information</Muted><Input value={report.competitorInfo} onChangeText={(value) => update("competitorInfo", value)} accessibilityLabel="Competitor information" />
      <Muted>Next action</Muted><Input value={report.nextAction} onChangeText={(value) => update("nextAction", value)} accessibilityLabel="Next action" />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: report.followupRequired }} onPress={() => { const required = !report.followupRequired; setReport((current) => ({ ...current, followupRequired: required, followupDate: required ? current.followupDate : null })); }} style={styles.check}><Text>{report.followupRequired ? "☑" : "☐"} Follow-up required</Text></Pressable>
      {report.followupRequired ? <><Muted>Follow-up date (YYYY-MM-DD)</Muted><Input value={report.followupDate ?? ""} onChangeText={(value) => update("followupDate", value)} placeholder="2026-12-31" accessibilityLabel="Follow-up date" /></> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}{message ? <Text style={{ color: colors.success }}>{message}</Text> : null}
      <Button title="Save draft" variant="secondary" onPress={() => void save()} loading={busy} disabled={busy} />
      <Button title="Submit visit" onPress={() => void submit()} loading={busy} disabled={busy} />
    </Card> : visit.report ? <Card><Heading>Report</Heading><Text>{visit.report.summary}</Text><Muted>{OUTCOME_LABELS[visit.report.outcome]}</Muted></Card> : null}
    {error && !editable ? <ErrorText>{error}</ErrorText> : null}
  </Screen>;
}

const styles = StyleSheet.create({ form: { gap: spacing.sm }, row: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, option: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: spacing.sm }, selected: { backgroundColor: colors.primary, borderColor: colors.primary }, check: { paddingVertical: spacing.sm }, photos: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, photoItem: { alignItems: "center", gap: spacing.xs }, photo: { width: 96, height: 72, borderRadius: radius.sm, backgroundColor: colors.border }, remove: { color: colors.danger, fontSize: 12, fontWeight: "600" } });
