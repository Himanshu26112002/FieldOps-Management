import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FOLLOWUP_STATUS_LABELS, VISIT_STATUS_LABELS, type Client, type Followup, type Visit } from "@fieldops/shared-types";
import { fetchMyClientDetails } from "@/lib/data";
import { useSession } from "@/lib/session";
import { formatDate, formatDateTime, isOverdue } from "@/lib/format";
import { SessionGate } from "@/components/session-gate";
import { Badge, Button, Card, Empty, ErrorText, HEADER_EDGES, Heading, Muted, Row, Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/colors";

interface ClientDetails {
  client: Client;
  visits: Visit[];
  followups: Followup[];
}

export default function ClientDetailsRoute() {
  return <SessionGate><ClientDetailsScreen /></SessionGate>;
}

function ClientDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const [details, setDetails] = useState<ClientDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !id) return;
    try {
      const result = await fetchMyClientDetails(id, session.uid, session.organization.id);
      setDetails(result);
      setError(null);
    } catch (cause) {
      const code = typeof cause === "object" && cause && "code" in cause ? String(cause.code) : "";
      setError(code.includes("permission-denied")
        ? "This client is not assigned to your account or is no longer available."
        : cause instanceof Error ? cause.message : "Could not load client details.");
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) return <Screen edges={HEADER_EDGES}><Heading>Client details</Heading><Muted>Loading client information…</Muted></Screen>;
  if (error) return <Screen edges={HEADER_EDGES}><Heading>Client unavailable</Heading><ErrorText>{error}</ErrorText><Button title="Back to clients" onPress={() => router.back()} /></Screen>;
  if (!details) return <Screen edges={HEADER_EDGES}><Heading>Client unavailable</Heading><Card><Empty title="Client not found" description="This client may have been deactivated or unassigned." /></Card><Button title="Back to clients" onPress={() => router.back()} /></Screen>;

  const { client, visits, followups } = details;
  const assignedOthers = client.assignedUserIds.filter((uid) => uid !== session?.uid).length;

  return <Screen edges={HEADER_EDGES}>
    <Heading>{client.name}</Heading>
    <Muted>{client.category || "Client"} · {client.city}</Muted>

    <Card style={styles.card}>
      <Row style={{ justifyContent: "space-between" }}>
        <Heading>Contact & address</Heading>
        <Badge label={client.status === "ACTIVE" ? "Active" : "Inactive"} tone={client.status === "ACTIVE" ? "success" : "neutral"} />
      </Row>
      <Detail label="Contact person" value={client.contactPerson} />
      <Detail label="Phone" value={client.phone} />
      <Detail label="Email" value={client.email} />
      <Detail label="Address" value={[client.addressLine1, client.addressLine2, client.city, client.state, client.postalCode].filter(Boolean).join(", ")} />
      <Detail label="Assigned salesperson" value={`${session?.profile.fullName ?? "You"}${assignedOthers ? ` · ${assignedOthers} other assigned` : ""}`} />
      {client.notes ? <Detail label="Notes" value={client.notes} /> : null}
    </Card>

    <Row style={styles.sectionHeader}>
      <Heading>Visit history</Heading>
      <Muted>{visits.length} {visits.length === 1 ? "visit" : "visits"}</Muted>
    </Row>
    {visits.length ? visits.map((visit) => <Pressable key={visit.id} onPress={() => router.push({ pathname: "/visit/[id]", params: { id: visit.id } })}>
      <Card>
        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}><Text style={{ fontWeight: "600" }}>{visit.report?.summary || "Visit report"}</Text><Muted>{visit.origin === "SCHEDULED" ? formatDateTime(visit.scheduledFor) : formatDate(visit.createdAt)}</Muted></View>
          <Badge label={VISIT_STATUS_LABELS[visit.status]} tone={visit.status === "APPROVED" ? "success" : visit.status === "RETURNED" || visit.status === "CANCELLED" ? "danger" : visit.status === "SUBMITTED" ? "warning" : "primary"} />
        </Row>
      </Card>
    </Pressable>) : <Card><Empty title="No visit history" description="Completed and scheduled visits for this client will appear here." /></Card>}

    <Row style={styles.sectionHeader}>
      <Heading>Follow-ups</Heading>
      <Pressable onPress={() => router.push({ pathname: "/new-followup", params: { clientId: client.id } })}><Text style={{ color: colors.primary, fontWeight: "600" }}>Add follow-up</Text></Pressable>
    </Row>
    {followups.length ? followups.map((followup) => {
      const overdue = followup.status === "OPEN" && isOverdue(followup.dueDate);
      return <Card key={followup.id}>
        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}><Text style={{ fontWeight: "600" }}>{followup.title}</Text><Muted>Due {formatDate(followup.dueDate)}</Muted></View>
          <Badge label={overdue ? "Overdue" : FOLLOWUP_STATUS_LABELS[followup.status]} tone={overdue ? "danger" : followup.status === "DONE" ? "success" : "primary"} />
        </Row>
        {followup.notes ? <Muted style={{ marginTop: spacing.sm }}>{followup.notes}</Muted> : null}
      </Card>;
    }) : <Card><Empty title="No follow-ups yet" description="Create a follow-up to keep the next action visible." /></Card>}

    <Button title="Schedule a visit" onPress={() => router.push({ pathname: "/schedule", params: { clientId: client.id } })} />
  </Screen>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Muted>{label}</Muted><Text>{value || "—"}</Text></View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  detail: { gap: spacing.xs },
  sectionHeader: { justifyContent: "space-between", alignItems: "center" },
});
