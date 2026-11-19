import * as Location from "expo-location";
import { Platform } from "react-native";

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

const PERMISSION_MESSAGE = "Location permission is required to check in and check out of visits.";
const NO_FIX_MESSAGE = "Could not get a GPS fix. Move near a window and retry.";

/** Browsers reject with a GeolocationPositionError, which is not an Error; give it a clear message. */
function positionError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  const code = typeof cause === "object" && cause && "code" in cause ? Number((cause as { code: unknown }).code) : 0;
  if (code === 1) return new Error(PERMISSION_MESSAGE);
  if (code === 3) return new Error(NO_FIX_MESSAGE);
  return new Error("Could not get your location. Turn on device location (GPS) and try again.");
}

/**
 * expo-location's web implementation accepts a cached position of any age, so check-out could
 * repeat the check-in fix. On web, ask the browser directly for a fresh one.
 */
function currentPosition(): Promise<{ coords: { latitude: number; longitude: number; accuracy: number | null } }> {
  if (Platform.OS !== "web") return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }),
  );
}

export async function captureGps(): Promise<GpsFix> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error(PERMISSION_MESSAGE);
  }
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) throw new Error("Turn on device location (GPS) and try again.");

  const position = await Promise.race([
    currentPosition().catch((cause: unknown) => {
      throw positionError(cause);
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(NO_FIX_MESSAGE)), 25_000)),
  ]);

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: Math.max(0, position.coords.accuracy ?? 0),
  };
}
