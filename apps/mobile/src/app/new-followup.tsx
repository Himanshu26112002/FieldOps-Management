import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { notify } from "@/lib/dialogs";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { Client } from "@fieldops/shared-types";
import { followupInputSchema } from "@fieldops/shared-validation";
import { createMyFollowup, fetchMyClients } from "@/lib/data";
import { useSession } from "@/lib/session";
import { SessionGate } from "@/components/session-gate";
import { Button, Card, Empty, ErrorText, HEADER_EDGES, Heading, Input, Muted, Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/colors";

function defaultDueDate() {
  const due = new Date();
  due.setDate(due.getDate() + 1);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;
}

export default function NewFollowupRoute() {
  return <SessionGate><NewFollowupScreen /></SessionGate>;
}

function NewFollowupScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { session } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const result = await fetchMyClients(session.uid, session.organization.id);
      setClients(result.items);
      setCached(result.fromCache);
      const preselected = clientId && result.items.some((client) => client.id === clientId) ? clientId : "";
      // A client passed in the route always wins; otherwise keep the user's choice or default to the first client.
      setSelectedClientId((current) => preselected || (result.items.some((client) => client.id === current) ? current : result.items[0]?.id ?? ""));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load assigned clients.");
    } finally {
      setLoading(false);
    }
  }, [clientId, session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function submit() {
    if (!session) return;
    const selectedClient = clients.find((client) => client.id === selectedClientId);
    if (!selectedClient) { setError("Choose an assigned client."); return; }
    const parsed = followupInputSchema.safeParse({
      clientId: selectedClientId,
      userId: session.uid,
      title,
      notes,
      dueDate,
      visitId: null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the follow-up details.");
      return;
    }
    if (cached) {
      setError("Reconnect to verify the client assignment before creating a follow-up.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createMyFollowup(parsed.data, session.organization.id);
      await notify("Follow-up created", `“${parsed.data.title}” was added for ${selectedClient.name}.`);
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/followups");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the follow-up.");
    } finally {
      setSaving(false);
    }
  }

  return <Screen edges={HEADER_EDGES}>
    <Heading>New follow-up</Heading>
    <Muted>Create a reminder for one of your assigned clients.</Muted>
    {cached ? <Card style={{ backgroundColor: colors.warningSoft, borderColor: "#fec84b" }}><Text style={{ color: colors.warning, fontWeight: "600" }}>Saved clients are shown offline</Text><Muted>Reconnect before creating a follow-up so assignment access can be checked.</Muted></Card> : null}
    {error ? <ErrorText>{error}</ErrorText> : null}
    {loading ? <Card><Muted>Loading your assigned clients…</Muted></Card> : clients.length ? <>
      <Card style={styles.clientList}>
        <Muted>Client</Muted>
        {clients.map((client) => <Pressable key={client.id} accessibilityRole="radio" accessibilityState={{ selected: selectedClientId === client.id }} onPress={() => setSelectedClientId(client.id)} style={[styles.client, selectedClientId === client.id && styles.clientSelected]}>
          <View style={{ flex: 1 }}><Text style={{ fontWeight: "600" }}>{client.name}</Text><Muted>{client.city} · {client.contactPerson}</Muted></View>
          <Text style={{ color: selectedClientId === client.id ? colors.primary : colors.muted }}>{selectedClientId === client.id ? "●" : "○"}</Text>
        </Pressable>)}
      </Card>
      <Card style={styles.form}>
        <Muted>Title</Muted>
        <Input value={title} onChangeText={setTitle} placeholder="e.g. Send product samples" maxLength={160} accessibilityLabel="Follow-up title" />
        <Muted>Description / notes</Muted>
        <Input value={notes} onChangeText={setNotes} placeholder="Add context for the next action (optional)" multiline maxLength={1000} accessibilityLabel="Follow-up description" />
        <Muted>Due date (YYYY-MM-DD)</Muted>
        <Input value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} accessibilityLabel="Due date" />
        <Muted>Status</Muted>
        <Text>Open</Text>
        <Muted>New follow-ups start open and can be completed from your Follow-ups list.</Muted>
        <Button title="Create follow-up" onPress={() => void submit()} loading={saving} disabled={saving || cached} />
      </Card>
    </> : error ? <Card><Empty title="Assigned clients unavailable" description="Check your connection and retry." /><Button title="Retry" variant="secondary" onPress={() => void load()} /></Card> : <Card><Empty title="No assigned clients" description="Ask your administrator to assign a client before creating follow-ups." /></Card>}
    <Button title="Cancel" variant="secondary" onPress={() => router.back()} disabled={saving} />
  </Screen>;
}

const styles = StyleSheet.create({
  clientList: { gap: spacing.sm },
  client: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.md },
  clientSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  form: { gap: spacing.sm },
});
