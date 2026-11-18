import NetInfo from "@react-native-community/netinfo";

export const OFFLINE_MESSAGE = "No internet connection. Connect and try again.";
export const TIMEOUT_MESSAGE = "The server did not respond. Check your connection; your change may still be saved.";
const WRITE_TIMEOUT_MS = 20_000;

/** Fail fast before a write when the device reports no network (Firestore would otherwise wait forever). */
export async function ensureOnline(): Promise<void> {
  let connected: boolean | null = null;
  try {
    connected = (await NetInfo.fetch()).isConnected;
  } catch {
    // NetInfo unavailable: let the request itself decide.
  }
  if (connected === false) throw new Error(OFFLINE_MESSAGE);
}

export async function isOnline(): Promise<boolean> {
  try {
    return (await NetInfo.fetch()).isConnected !== false;
  } catch {
    return true;
  }
}

/** Reject with a friendly message if the server does not answer in time. The underlying request keeps running. */
export function withTimeout<T>(promise: Promise<T>, ms = WRITE_TIMEOUT_MS, message = TIMEOUT_MESSAGE): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function errorCode(cause: unknown): string {
  return typeof cause === "object" && cause && "code" in cause ? String((cause as { code: unknown }).code) : "";
}

/** Transport-level failures where cached data is a reasonable fallback. */
export function isNetworkError(cause: unknown): boolean {
  const code = errorCode(cause);
  if (["unavailable", "deadline-exceeded", "auth/network-request-failed"].some((value) => code.endsWith(value))) return true;
  const message = cause instanceof Error ? cause.message.toLowerCase() : "";
  return message === OFFLINE_MESSAGE.toLowerCase() || message === TIMEOUT_MESSAGE.toLowerCase()
    || message.includes("offline") || message.includes("network");
}
