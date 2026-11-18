import { Platform } from "react-native";

export const colors = {
  background: "#f7f8fa",
  card: "#ffffff",
  border: "#e4e7ec",
  text: "#101828",
  muted: "#667085",
  primary: "#1d4ed8",
  primarySoft: "#e8efff",
  success: "#067647",
  successSoft: "#ecfdf3",
  warning: "#b54708",
  warningSoft: "#fffaeb",
  danger: "#b42318",
  dangerSoft: "#fef3f2",
  overlay: "rgba(16,24,40,0.45)",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = { sm: 8, md: 12, lg: 16 } as const;

export const shadow = Platform.select({
  ios: {
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 1 },
  default: {},
});
