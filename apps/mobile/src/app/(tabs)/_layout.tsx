import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/colors";

export default function TabsLayout() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading your workspace…</Text>
      </View>
    );
  }
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11 },
        tabBarStyle: { borderTopColor: colors.border, height: 60, paddingBottom: 6, paddingTop: 4 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Today" }} />
      <Tabs.Screen name="clients" options={{ title: "Clients" }} />
      <Tabs.Screen name="visits" options={{ title: "Visits" }} />
      <Tabs.Screen name="followups" options={{ title: "Follow-ups" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.background },
  muted: { color: colors.muted, fontSize: 13 },
});
