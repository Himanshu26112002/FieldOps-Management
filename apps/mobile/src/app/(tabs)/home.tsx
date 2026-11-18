import { useCallback, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { VISIT_STATUS_LABELS } from "@fieldops/shared-types";
import type { Followup, Visit } from "@fieldops/shared-types";
import { fetchMyClients, fetchMyFollowups, fetchMyVisits } from "@/lib/data";
import { useSession } from "@/lib/session";
import { formatDate, formatDateTime, isOverdue } from "@/lib/format";
import { Badge, Button, Card, Empty, ErrorText, Heading, Muted, Row, Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/colors";

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [visitResult, followupResult, clientResult] = await Promise.all([
        fetchMyVisits(session.uid, session.organization.id),
        fetchMyFollowups(session.uid, session.organization.id),
        fetchMyClients(session.uid, session.organization.id),
      ]);
      setVisits(visitResult.items);
      setFollowups(followupResult.items);
      setClientCount(clientResult.items.length);
      setCached(visitResult.fromCache || followupResult.fromCache || clientResult.fromCache);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load today's summary.");
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const today = visits.filter((visit) => {
    const when = visit.scheduledFor?.toDate?.();
    return visit.status === "SCHEDULED" && when && when >= start && when < end;
  });
  // Started visits come first so an in-progress report is always one tap away.
  const active = visits.filter((visit) => visit.status === "IN_PROGRESS");
  const upcoming = [
    ...active,
    ...visits
      .filter((visit) => visit.status === "SCHEDULED" && (visit.scheduledFor?.toMillis?.() ?? 0) >= start.getTime())
      .sort((a, b) => (a.scheduledFor?.toMillis?.() ?? 0) - (b.scheduledFor?.toMillis?.() ?? 0))
      .slice(0, 4),
  ];
  const openFollowups = followups
    .filter((followup) => followup.status === "OPEN")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const pendingApproval = visits.filter((visit) => visit.status === "SUBMITTED").length;
  const returned = visits.filter((visit) => visit.status === "RETURNED");

  if (!session) return null;

  return (
    <Screen
      style={{ gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <View>
        <Muted>{session.organization.name}</Muted>
        <Heading>Hello, {session.profile.fullName.split(" ")[0]}</Heading>
        <Muted>Here is your field day at a glance.</Muted>
      </View>

      {cached ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: "#fec84b" }}>
          <Text style={{ color: colors.warning, fontWeight: "600" }}>Showing saved data</Text>
          <Muted>You are offline. Check-ins and submissions require a connection.</Muted>
        </Card>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <View style={styles.statGrid}>
        <Card style={styles.stat}>
          <Muted>Assigned clients</Muted>
          <Text style={styles.statValue}>{clientCount}</Text>
        </Card>
        <Card style={styles.stat}>
          <Muted>Scheduled today</Muted>
          <Text style={styles.statValue}>{today.length}</Text>
        </Card>
        <Card style={styles.stat}>
          <Muted>Open follow-ups</Muted>
          <Text style={styles.statValue}>{openFollowups.length}</Text>
        </Card>
        <Card style={styles.stat}>
          <Muted>Awaiting approval</Muted>
          <Text style={styles.statValue}>{pendingApproval}</Text>
        </Card>
      </View>

      {returned.length ? (
        <Pressable onPress={() => router.push({ pathname: "/visit/[id]", params: { id: returned[0].id } })}>
          <Card style={{ backgroundColor: colors.dangerSoft, borderColor: "#fda29b" }}>
            <Text style={{ color: colors.danger, fontWeight: "600" }}>Correction requested</Text>
            <Muted>{returned[0].clientName}: {returned[0].returnReason || "Open the visit to review and resubmit."}</Muted>
          </Card>
        </Pressable>
      ) : null}

      <Row style={{ justifyContent: "space-between" }}>
        <Heading>Upcoming visits</Heading>
        <Pressable onPress={() => router.push("/schedule")}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Schedule</Text>
        </Pressable>
      </Row>

      {upcoming.length ? (
        upcoming.map((visit) => (
          <Pressable key={visit.id} onPress={() => router.push({ pathname: "/visit/[id]", params: { id: visit.id } })}>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600" }}>{visit.clientName}</Text>
                  <Muted>{visit.clientCity} · {visit.status === "IN_PROGRESS" ? `Started ${formatDateTime(visit.checkIn?.capturedAt)}` : formatDateTime(visit.scheduledFor)}</Muted>
                </View>
                <Badge label={visit.status === "IN_PROGRESS" ? VISIT_STATUS_LABELS.IN_PROGRESS : "Scheduled"} tone={visit.status === "IN_PROGRESS" ? "warning" : "primary"} />
              </Row>
            </Card>
          </Pressable>
        ))
      ) : (
        <Card>
          <Empty title="No scheduled visits" description="Schedule one or start an ad hoc visit from a client." />
          <Button title="Schedule a visit" onPress={() => router.push("/schedule")} />
        </Card>
      )}

      <Row style={{ justifyContent: "space-between" }}>
        <Heading>Follow-ups</Heading>
        <Pressable onPress={() => router.push("/(tabs)/followups")}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>View all</Text>
        </Pressable>
      </Row>

      {openFollowups.slice(0, 4).map((followup) => (
        <Card key={followup.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600" }}>{followup.title}</Text>
              <Muted>{followup.clientName} · due {formatDate(followup.dueDate)}</Muted>
            </View>
            <Badge label={isOverdue(followup.dueDate) ? "Overdue" : "Open"} tone={isOverdue(followup.dueDate) ? "danger" : "warning"} />
          </Row>
        </Card>
      ))}
      {!openFollowups.length ? (
        <Card>
          <Empty title="No open follow-ups" description="You are all caught up." />
        </Card>
      ) : null}

      <Card>
        <Heading>Recent visits</Heading>
        <View style={{ marginTop: spacing.sm }}>
          {visits.slice(0, 5).map((visit) => (
            <Pressable key={visit.id} onPress={() => router.push({ pathname: "/visit/[id]", params: { id: visit.id } })}>
              <Row style={{ justifyContent: "space-between", paddingVertical: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text>{visit.clientName}</Text>
                  <Muted>{formatDate(visit.createdAt)}</Muted>
                </View>
                <Badge
                  label={VISIT_STATUS_LABELS[visit.status]}
                  tone={
                    visit.status === "APPROVED"
                      ? "success"
                      : visit.status === "RETURNED" || visit.status === "CANCELLED"
                        ? "danger"
                        : visit.status === "SUBMITTED"
                          ? "warning"
                          : "neutral"
                  }
                />
              </Row>
            </Pressable>
          ))}
          {!visits.length ? <Empty title="No visits yet" description="Your first check-in will appear here." /> : null}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: { width: "48%", flexGrow: 1 },
  statValue: { fontSize: 24, fontWeight: "700", marginTop: 2 },
});
