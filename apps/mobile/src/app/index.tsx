import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/colors";

export default function IndexRoute() {
  const { session, loading } = useSession();
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>;
  return <Redirect href={session ? "/(tabs)/home" : "/login"} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background } });
