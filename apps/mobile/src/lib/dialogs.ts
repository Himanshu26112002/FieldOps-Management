import { Alert, Platform } from "react-native";

// React Native Web's Alert.alert ignores buttons, so confirmations and notices would
// silently do nothing in the browser build. These helpers use the browser's own dialogs
// on web and the native Alert everywhere else.

export function confirmAction(title: string, message: string, confirmText: string, destructive = false): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function notify(title: string, message: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: "OK", onPress: () => resolve() }], { cancelable: true, onDismiss: () => resolve() });
  });
}
