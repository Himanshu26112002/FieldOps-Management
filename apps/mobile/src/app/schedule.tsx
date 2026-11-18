import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import type { Client } from "@fieldops/shared-types";
import { fetchMyClients, scheduleOwnVisit } from "@/lib/data";
import { useSession } from "@/lib/session";
import { parseDateTimeInput, toDateTimeInput } from "@/lib/format";
import { SessionGate } from "@/components/session-gate";
import { Button, Card, Empty, ErrorText, HEADER_EDGES, Heading, Input, Muted, Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/colors";

export default function ScheduleRoute() {
  return <SessionGate><ScheduleScreen /></SessionGate>;
}

function defaultWhen() {
  return toDateTimeInput(new Date(Date.now() + 60 * 60 * 1000));
}

function ScheduleScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { session } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState("");
  const [when, setWhen] = useState(defaultWhen);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const result = await fetchMyClients(session.uid, session.organization.id);
      setClients(result.items);
      const preselected = clientId && result.items.some((client) => client.id === clientId) ? clientId : "";
      // A client passed in the route always wins; otherwise keep the user's choice or default to the first client.
      setSelected((current) => preselected || (result.items.some((client) => client.id === current) ? current : result.items[0]?.id ?? ""));
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load assigned clients."); }
    finally { setLoading(false); }
  }, [clientId, session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function submit() {
    if (!session) return;
    const client = clients.find((item) => item.id === selected);
    const scheduledFor = parseDateTimeInput(when);
    if (!client) { setError("Choose an assigned client."); return; }
    if (!scheduledFor || scheduledFor <= new Date()) { setError("Choose a valid future date and time (YYYY-MM-DD HH:MM)."); return; }
    setSaving(true); setError(null);
    try {
      const id = await scheduleOwnVisit(client, session.profile, session.organization.id, scheduledFor);
      router.replace({ pathname: "/visit/[id]", params: { id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not schedule this visit."); }
    finally { setSaving(false); }
  }

  return <Screen edges={HEADER_EDGES}>
    <Heading>Schedule a visit</Heading>
    <Muted>Choose one of your assigned clients and a future time.</Muted>
    {error ? <ErrorText>{error}</ErrorText> : null}
    {loading ? <Muted>Loading assigned clients…</Muted> : !clients.length ? <Card><Empty title="No assigned clients" description="Ask your administrator to assign a client before scheduling." /></Card> : <>
      <Card style={styles.list}>
        <Muted>Client</Muted>
        {clients.map((client) => <Pressable key={client.id} onPress={() => setSelected(client.id)} style={[styles.client, selected === client.id && styles.selected]}><View style={{ flex: 1 }}><Text style={{ fontWeight: "600" }}>{client.name}</Text><Muted>{client.city} · {client.contactPerson}</Muted></View><Text style={{ color: selected === client.id ? colors.primary : colors.muted }}>{selected === client.id ? "●" : "○"}</Text></Pressable>)}
      </Card>
      <Card style={styles.list}><Muted>Date and time (local time)</Muted><Input value={when} onChangeText={setWhen} placeholder="YYYY-MM-DD HH:MM" accessibilityLabel="Visit date and time" /><Button title="Schedule visit" onPress={() => void submit()} loading={saving} disabled={saving} /></Card>
    </>}
    <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
  </Screen>;
}

const styles = StyleSheet.create({ list: { gap: spacing.sm }, client: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.md, gap: spacing.sm }, selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft } });
