import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function cloudinaryConfigured(): boolean {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

// Cloudinary auto-detects the real container format for its delivery URL
// (e.g. a browser's "audio/webm" recording comes back as a plain .webm
// URL) -- it does NOT preserve an arbitrary custom extension. That means
// extension alone can't tell a voice message apart from an actual video
// clip once it's on Cloudinary, unlike the local-disk path where we fully
// control the filename. Voice messages go in their own folder instead
// (verdant-uploads/voice/...) as a signal isAudioUrl() can check for
// regardless of what extension Cloudinary ends up serving it as.
export function uploadBufferToCloudinary(
  buffer: Buffer,
  options: { public_id: string; resource_type?: "auto" | "image" | "video" | "raw"; folder?: string }
): Promise<{ secure_url: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder ?? "verdant-uploads",
        resource_type: options.resource_type ?? "auto",
        public_id: options.public_id,
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Cloudinary upload returned no result"));
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}
