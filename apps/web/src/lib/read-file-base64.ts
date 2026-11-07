export function readFileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result.split(",", 2)[1] ?? "")
        : reject(new Error("file-read"));
    reader.onerror = () => reject(new Error("file-read"));
    reader.readAsDataURL(file);
  });
}
