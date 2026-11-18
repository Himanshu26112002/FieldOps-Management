import * as Location from "expo-location";

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export async function captureGps(): Promise<GpsFix> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Location permission is required to check in and check out of visits.");
  }
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) throw new Error("Turn on device location (GPS) and try again.");

  const position = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Could not get a GPS fix. Move near a window and retry.")), 25_000)),
  ]);

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: Math.max(0, position.coords.accuracy ?? 0),
  };
}
