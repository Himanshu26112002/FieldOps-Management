import type { ReactNode } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/colors";

/** Guards stack screens outside the tabs: spinner while the account loads, login when signed out. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!session) return <Redirect href="/login" />;
  return children;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background } });
