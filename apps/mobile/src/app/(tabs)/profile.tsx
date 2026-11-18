import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { notify } from "@/lib/dialogs";
import { useSession } from "@/lib/session";
import { getFirebase } from "@/lib/firebase";
import { ensureOnline, withTimeout } from "@/lib/network";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { paths } from "@fieldops/shared-types";
import { Button, Card, ErrorText, Heading, Input, Muted, Screen, Text } from "@/components/ui";
import { spacing } from "@/lib/colors";

export default function ProfileScreen() {
  const { session, refresh, logout } = useSession();
  const [fullName, setFullName] = useState(session?.profile.fullName ?? "");
  const [phone, setPhone] = useState(session?.profile.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedProfile, setSyncedProfile] = useState(session?.profile);

  // Reset the form when the stored profile changes (adjusting state during render, not in an effect).
  if (session?.profile !== syncedProfile) {
    setSyncedProfile(session?.profile);
    setFullName(session?.profile.fullName ?? "");
    setPhone(session?.profile.phone ?? "");
  }

  async function save() {
    if (!session) return;
    if (fullName.trim().length < 2) { setError("Enter a name with at least 2 characters."); return; }
    setSaving(true);
    setError(null);
    try {
      const { db } = getFirebase();
      await ensureOnline();
      await withTimeout(updateDoc(doc(db, paths.user(session.organization.id, session.uid)), { fullName: fullName.trim(), phone: phone.trim(), updatedAt: serverTimestamp() }));
      await refresh();
      await notify("Profile updated", "Your contact details have been saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your profile.");
    } finally { setSaving(false); }
  }

  if (!session) return null;
  return <Screen>
    <Heading>Profile</Heading>
    <Muted>Manage your contact details and account session.</Muted>
    <Card style={styles.card}>
      <Muted>Email</Muted><Text>{session.email}</Text>
      <Muted>Role</Muted><Text>{session.role === "USER" ? "Salesperson" : "Administrator"}</Text>
      <View style={styles.field}><Muted>Full name</Muted><Input value={fullName} onChangeText={setFullName} autoCapitalize="words" maxLength={120} accessibilityLabel="Full name" /></View>
      <View style={styles.field}><Muted>Phone</Muted><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} accessibilityLabel="Phone" /></View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Save changes" onPress={() => void save()} loading={saving} />
    </Card>
    <Button title="Sign out" variant="secondary" onPress={() => void logout()} />
  </Screen>;
}

const styles = StyleSheet.create({ card: { gap: spacing.md }, field: { gap: spacing.xs }, });
