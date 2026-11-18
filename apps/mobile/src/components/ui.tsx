import type { ReactElement, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type RefreshControlProps,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing } from "@/lib/colors";

export function Text({ style, ...props }: React.ComponentProps<typeof RNText>) {
  return <RNText style={[styles.text, style]} {...props} />;
}

const TAB_EDGES: Edge[] = ["top", "left", "right"];
/** Stack screens with a native header: the header already covers the top inset. */
export const HEADER_EDGES: Edge[] = ["left", "right"];

export function Screen({
  children,
  scroll = true,
  style,
  edges = TAB_EDGES,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  edges?: Edge[];
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const content = <View style={[styles.content, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Muted({ children, style, numberOfLines }: { children: ReactNode; style?: TextStyle; numberOfLines?: number }) {
  return <Text style={[styles.muted, style]} numberOfLines={numberOfLines}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "success";
  disabled?: boolean;
  loading?: boolean;
}) {
  const palette = {
    primary: { background: colors.primary, text: "#ffffff", border: colors.primary },
    secondary: { background: colors.card, text: colors.text, border: colors.border },
    danger: { background: colors.dangerSoft, text: colors.danger, border: colors.danger },
    success: { background: colors.success, text: "#ffffff", border: colors.success },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.text} /> : <Text style={{ color: palette.text, fontWeight: "600" }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} style={[styles.input, props.style]} {...props} />;
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" | "primary" }) {
  const palette = {
    neutral: { background: "#f2f4f7", text: colors.muted },
    success: { background: colors.successSoft, text: colors.success },
    warning: { background: colors.warningSoft, text: colors.warning },
    danger: { background: colors.dangerSoft, text: colors.danger },
    primary: { background: colors.primarySoft, text: colors.primary },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={{ color: palette.text, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export function Empty({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontWeight: "600" }}>{title}</Text>
      {description ? <Text style={styles.muted}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xl },
  content: { padding: spacing.lg, gap: spacing.md },
  text: { color: colors.text, fontSize: 15 },
  heading: { fontSize: 20, fontWeight: "700", color: colors.text },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  button: { borderRadius: radius.md, borderWidth: 1, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center", minHeight: 44 },
  disabled: { opacity: 0.55 },
  field: { gap: spacing.xs },
  label: { fontSize: 13, fontWeight: "500", color: colors.muted },
  hint: { fontSize: 11, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
    minHeight: 44,
  },
  badge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: "flex-start" },
  error: { color: colors.danger, fontSize: 13 },
  empty: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.xs },
});
