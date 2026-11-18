import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { VISIT_STATUS_LABELS, type Visit } from "@fieldops/shared-types";
import { fetchMyVisits } from "@/lib/data";
import { useSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { Badge, Card, Empty, ErrorText, Heading, Muted, Row, Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/colors";

const FILTERS = ["ALL", "OPEN", "SUBMITTED", "APPROVED"] as const;

function toneFor(status: Visit["status"]) {
  if (status === "APPROVED") return "success" as const;
  if (status === "RETURNED" || status === "CANCELLED") return "danger" as const;
  if (status === "SUBMITTED") return "warning" as const;
  if (status === "IN_PROGRESS") return "primary" as const;
  return "neutral" as const;
}

export default function VisitsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const result = await fetchMyVisits(session.uid, session.organization.id);
      setVisits(result.items);
      setCached(result.fromCache);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load visits.");
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    return visits.filter((visit) => {
      if (filter === "ALL") return true;
      if (filter === "OPEN") return ["SCHEDULED", "IN_PROGRESS", "RETURNED"].includes(visit.status);
      return visit.status === filter;
    });
  }, [visits, filter]);

  return (
    <Screen>
      <Heading>Visits</Heading>
      <Muted>Check in, capture the report and track approval.</Muted>

      {cached ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: "#fec84b" }}>
          <Text style={{ color: colors.warning, fontWeight: "600" }}>Showing saved visits</Text>
        </Card>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <Row style={styles.filters}>
        {FILTERS.map((value) => (
          <Pressable
            key={value}
            onPress={() => setFilter(value)}
            style={[styles.chip, filter === value && styles.chipActive]}
          >
            <Text style={{ color: filter === value ? "#ffffff" : colors.muted, fontSize: 12, fontWeight: "600" }}>
              {value === "ALL" ? "All" : value === "OPEN" ? "Open" : VISIT_STATUS_LABELS[value]}
            </Text>
          </Pressable>
        ))}
      </Row>

      {filtered.map((visit) => (
        <Pressable key={visit.id} onPress={() => router.push({ pathname: "/visit/[id]", params: { id: visit.id } })}>
          <Card>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600" }}>{visit.clientName}</Text>
                <Muted>{visit.clientCity}</Muted>
                <Muted>
                  {visit.origin === "SCHEDULED"
                    ? `Scheduled ${formatDateTime(visit.scheduledFor)}`
                    : `Ad hoc · ${formatDate(visit.createdAt)}`}
                </Muted>
              </View>
              <Badge label={VISIT_STATUS_LABELS[visit.status]} tone={toneFor(visit.status)} />
            </Row>
            {visit.report ? (
              <Muted style={{ marginTop: spacing.sm }} numberOfLines={2}>{visit.report.summary}</Muted>
            ) : null}
          </Card>
        </Pressable>
      ))}

      {!filtered.length ? (
        <Card>
          <Empty
            title={visits.length ? "No visits in this filter" : "No visits yet"}
            description={visits.length ? "Try another filter." : "Start an ad hoc visit from a client or schedule one."}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexWrap: "wrap" },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
