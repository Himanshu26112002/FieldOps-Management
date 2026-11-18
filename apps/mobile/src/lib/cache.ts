import AsyncStorage from "@react-native-async-storage/async-storage";
import { Timestamp } from "firebase/firestore";

const PREFIX = "fieldops:cache:";

/** JSON turns Firestore Timestamps into { seconds, nanoseconds }; turn them back so .toDate()/.toMillis() keep working. */
function reviveTimestamps(_key: string, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    typeof record.seconds === "number"
    && typeof record.nanoseconds === "number"
    && keys.every((key) => key === "seconds" || key === "nanoseconds" || key === "type")
  ) {
    return new Timestamp(record.seconds, record.nanoseconds);
  }
  return value;
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw, reviveTimestamps) as T) : null;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Cache failures must never block the screen.
  }
}

export async function clearCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(PREFIX)));
}
