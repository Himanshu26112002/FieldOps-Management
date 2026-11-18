import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { Client } from "@fieldops/shared-types";
import { fetchMyClients, startAdHocVisit } from "@/lib/data";
import { captureGps } from "@/lib/location";
import { ensureOnline } from "@/lib/network";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, Empty, ErrorText, Heading, Muted, Row, Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/colors";

export default function ClientsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const result = await fetchMyClients(session.uid, session.organization.id);
      setClients(result.items);
      setCached(result.fromCache);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load clients.");
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((client) =>
      !term ? true : [client.name, client.city, client.contactPerson, client.phone].join(" ").toLowerCase().includes(term),
    );
  }, [clients, search]);

  async function startVisit(client: Client) {
    if (!session) return;
    setBusyId(client.id);
    setError(null);
    try {
      await ensureOnline();
      const gps = await captureGps();
      const visitId = await startAdHocVisit(client, session.profile, gps);
      router.push({ pathname: "/visit/[id]", params: { id: visitId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the visit.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <Heading>Clients</Heading>
      <Muted>Accounts assigned to you. Start a visit when you are on site.</Muted>

      {cached ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: "#fec84b" }}>
          <Text style={{ color: colors.warning, fontWeight: "600" }}>Showing saved clients</Text>
          <Muted>Check-ins need a connection.</Muted>
        </Card>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search clients"
        placeholderTextColor={colors.muted}
        style={styles.search}
      />

      {filtered.map((client) => (
        <Card key={client.id}>
          <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
                <Pressable onPress={() => router.push({ pathname: "/client/[id]", params: { id: client.id } })} accessibilityRole="button">
                  <Text style={{ fontWeight: "600", color: colors.primary }}>{client.name}</Text>
                </Pressable>
              <Muted>{client.contactPerson} · {client.phone}</Muted>
              <Muted>{client.addressLine1}, {client.city}</Muted>
            </View>
            <Badge label={client.category || "Client"} tone="neutral" />
          </Row>
          <Row style={{ marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Check in now"
                onPress={() => void startVisit(client)}
                loading={busyId === client.id}
                disabled={Boolean(busyId)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Schedule"
                variant="secondary"
                onPress={() => router.push({ pathname: "/schedule", params: { clientId: client.id } })}
              />
            </View>
          </Row>
        </Card>
      ))}

      {!filtered.length ? (
        <Card>
          <Empty
            title={clients.length ? "No clients match" : "No clients assigned"}
            description={clients.length ? "Try a different search." : "Your administrator will assign clients to you."}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
});
