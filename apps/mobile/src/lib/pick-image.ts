import * as ImagePicker from "expo-image-picker";
import { PICK_IMAGE as M } from "./pick-image.messages";
import { prepareImageUpload } from "./prepare-image-upload";

export async function pickImage(camera = false) {
  const permission = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error(M.denied);
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    base64: true,
    quality: 0.65,
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return prepareImageUpload(asset);
}
