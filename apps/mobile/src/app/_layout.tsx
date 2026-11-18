import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "@/lib/session";
import { colors } from "@/lib/colors";

const detailHeader = {
  headerShown: true,
  headerBackTitle: "Back",
  headerTintColor: colors.primary,
  headerTitleStyle: { color: colors.text },
  headerStyle: { backgroundColor: colors.card },
} as const;

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="visit/[id]" options={{ ...detailHeader, title: "Visit" }} />
        <Stack.Screen name="client/[id]" options={{ ...detailHeader, title: "Client" }} />
        <Stack.Screen name="schedule" options={{ ...detailHeader, title: "Schedule visit" }} />
        <Stack.Screen name="new-followup" options={{ ...detailHeader, title: "New follow-up" }} />
      </Stack>
    </SessionProvider>
  );
}
