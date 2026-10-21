export interface CloudinaryCredentials {
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}

export interface CloudinaryResource {
  publicId: string;
  resourceType: "image" | "raw";
  format?: string;
}
