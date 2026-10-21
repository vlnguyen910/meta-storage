export type StoredPhoto = { publicId: string; format: string };
export interface InspectionPhotoStorage {
  upload(inspectionId: string, mimeType: string, dataBase64: string): Promise<StoredPhoto>;
  remove(publicId: string): Promise<void>;
  readUrl(publicId: string, format: string): string;
}
