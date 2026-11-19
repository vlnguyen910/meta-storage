import type { InspectionEvidenceInput } from "@metastorage/contracts";
import * as ImagePicker from "expo-image-picker";
import { PICK_IMAGE as M } from "./pick-image.messages";
import { prepareImageUpload } from "./prepare-image-upload";

export type PickImageOptions = {
  camera?: boolean;
  limit?: number;
};

export async function pickImages({
  camera = false,
  limit = 1,
}: PickImageOptions = {}): Promise<InspectionEvidenceInput[]> {
  if (limit <= 0) return [];
  const permission = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error(M.denied);
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    base64: true,
    quality: 0.65,
    allowsMultipleSelection: !camera && limit > 1,
    selectionLimit: camera ? 1 : Math.max(1, limit),
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.slice(0, limit).map((asset) => prepareImageUpload(asset));
}

export async function pickImage(camera = false): Promise<InspectionEvidenceInput | null> {
  const images = await pickImages({ camera, limit: 1 });
  return images[0] ?? null;
}
