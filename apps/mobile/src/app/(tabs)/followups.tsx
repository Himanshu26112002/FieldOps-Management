import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { confirmAction } from "@/lib/dialogs";
import { useFocusEffect, useRouter } from "expo-router";
import type { Followup } from "@fieldops/shared-types";
import { FOLLOWUP_STATUS_LABELS } from "@fieldops/shared-types";
import { completeMyFollowup, fetchMyFollowups } from "@/lib/data";
import { useSession } from "@/lib/session";
import { formatDate, isOverdue } from "@/lib/format";
import { Badge, Button, Card, Empty, ErrorText, Heading, Muted, Row, Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/colors";

const FILTERS = ["OPEN", "DONE", "ALL"] as const;
type Filter = (typeof FILTERS)[number];

export default function FollowupsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [items, setItems] = useState<Followup[]>([]);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [cached, setCached] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const result = await fetchMyFollowups(session.uid, session.organization.id);
      setItems(result.items);
      setCached(result.fromCache);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load follow-ups.");
    }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => items
    .filter((item) => filter === "ALL" || item.status === filter)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [items, filter]);

  async function complete(item: Followup) {
    if (await confirmAction("Complete follow-up", `Mark “${item.title}” for ${item.clientName} as done?`, "Mark done")) {
      await finish(item, "");
    }
  }

  async function finish(item: Followup, note: string) {
    if (!session) return;
    setBusyId(item.id);
    setError(null);
    try {
      await completeMyFollowup(item, session.organization.id, note.trim());
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete this follow-up.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <Heading>Follow-ups</Heading>
      <Muted>Keep client commitments on track.</Muted>
      <Button title="Create follow-up" onPress={() => router.push("/new-followup")} />
      {cached ? <Card style={{ backgroundColor: colors.warningSoft, borderColor: "#fec84b" }}><Text style={{ color: colors.warning, fontWeight: "600" }}>Showing saved follow-ups</Text></Card> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Row style={styles.filters}>
        {FILTERS.map((value) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.chip, filter === value && styles.chipActive]}><Text style={{ color: filter === value ? "#fff" : colors.muted, fontSize: 12, fontWeight: "600" }}>{value === "ALL" ? "All" : FOLLOWUP_STATUS_LABELS[value]}</Text></Pressable>)}
      </Row>
      {filtered.map((item) => {
        const overdue = item.status === "OPEN" && isOverdue(item.dueDate);
        return <Card key={item.id}>
          <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: "600" }}>{item.title}</Text><Muted>{item.clientName}</Muted></View>
            <Badge label={overdue ? "Overdue" : FOLLOWUP_STATUS_LABELS[item.status]} tone={overdue ? "danger" : item.status === "DONE" ? "success" : "primary"} />
          </Row>
          <Muted>Due {formatDate(item.dueDate)}</Muted>
          {item.notes ? <Text>{item.notes}</Text> : null}
          {item.status === "OPEN" ? <Button title="Mark complete" onPress={() => complete(item)} loading={busyId === item.id} disabled={Boolean(busyId) || cached} /> : item.completionNote ? <Muted>Completed: {item.completionNote}</Muted> : null}
        </Card>;
      })}
      {!filtered.length ? <Card><Empty title={items.length ? "No follow-ups in this filter" : "No follow-ups yet"} description={items.length ? "Choose another filter to see more." : "New follow-ups from your visits will appear here."} /></Card> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ filters: { flexWrap: "wrap" }, chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, chipActive: { backgroundColor: colors.primary, borderColor: colors.primary } });
