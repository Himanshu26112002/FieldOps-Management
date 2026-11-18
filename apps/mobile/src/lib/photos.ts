import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export interface PhotoResult {
  base64: string;
  sizeBytes: number;
}

export const MAX_PHOTO_BYTES = 350_000;
export const MAX_PHOTOS_PER_VISIT = 5;

// First pass keeps the agreed quality; the retry trades detail for size before giving up.
const COMPRESSION_STEPS = [
  { width: 1280, compress: 0.7 },
  { width: 960, compress: 0.5 },
] as const;

async function compress(uri: string): Promise<PhotoResult> {
  for (const step of COMPRESSION_STEPS) {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: step.width } }],
      { compress: step.compress, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!manipulated.base64) throw new Error("Could not compress the photo.");
    const sizeBytes = Math.floor((manipulated.base64.length * 3) / 4);
    if (sizeBytes <= MAX_PHOTO_BYTES) return { base64: manipulated.base64, sizeBytes };
  }
  throw new Error("Compressed photo still exceeds 350 KB. Try a smaller image.");
}

/** Capture a new photo with the camera. Resolves null when the user cancels. */
export async function takeCompressedPhoto(): Promise<PhotoResult | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Camera permission is required to take a photo.");
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (result.canceled || !result.assets[0]) return null;
  return compress(result.assets[0].uri);
}

/** Pick an existing photo from the library. Resolves null when the user cancels. */
export async function pickCompressedPhoto(): Promise<PhotoResult | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Photo library permission is required.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return compress(result.assets[0].uri);
}
