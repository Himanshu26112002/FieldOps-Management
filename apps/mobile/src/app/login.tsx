"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getFirebase } from "@/lib/firebase";
import { errorCode, OFFLINE_MESSAGE } from "@/lib/network";
import { useSession } from "@/lib/session";
import { colors, radius, spacing } from "@/lib/colors";

function signInMessage(cause: unknown): string {
  switch (errorCode(cause)) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Incorrect email or password.";
    case "auth/wrong-password":
      return "Incorrect password. Try again.";
    case "auth/user-not-found":
      return "No account exists for this email address.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your administrator.";
    case "auth/too-many-requests":
      return "Too many sign-in attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return OFFLINE_MESSAGE;
    default:
      return "Sign in failed. Check your details and try again.";
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const { session, error: sessionError, offline, loading: sessionLoading, refresh, logout } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/(tabs)/home");
  }, [session, router]);

  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const { auth } = getFirebase();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/(tabs)/home");
    } catch (cause) {
      setError(signInMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  if (offline) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>FieldOps AI</Text>
          <Text style={styles.subtitle}>You are signed in, but your account could not be loaded.</Text>
          {sessionError ? <Text style={styles.error}>{sessionError}</Text> : null}
          <Pressable style={[styles.button, sessionLoading && styles.buttonDisabled]} onPress={() => void refresh()} disabled={sessionLoading}>
            {sessionLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Retry</Text>}
          </Pressable>
          <Pressable style={styles.link} onPress={() => void logout().catch(() => {})}>
            <Text style={styles.linkText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const shownError = error ?? sessionError;
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>FieldOps AI</Text>
        <Text style={styles.subtitle}>Sales field force management</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@company.com"
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter your password"
            style={styles.input}
          />
        </View>
        {shownError ? <Text style={styles.error}>{shownError}</Text> : null}
        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={signIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl },
  title: { fontSize: 22, fontWeight: "600", color: colors.text },
  subtitle: { marginTop: 4, color: colors.muted },
  field: { marginTop: spacing.lg },
  label: { fontSize: 13, color: colors.muted, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text },
  error: { marginTop: spacing.md, color: colors.danger },
  button: { marginTop: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: "center", paddingVertical: spacing.md },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#ffffff", fontWeight: "500" },
  link: { marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.sm },
  linkText: { color: colors.primary, fontWeight: "500" },
});
