import { createBrowserClient } from "@supabase/ssr";
import { PhotoData } from "@/types/api";

interface UploadResult {
  urls: string[];
  errors: string[];
}

// Create a typed Supabase client for storage operations
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createBrowserClient(url, key);
}

/**
 * Sanitize filename to only allow alphanumeric, dashes, underscores
 * Preserves file extension
 * Example: "My Photo!.jpg" -> "My-Photo.jpg"
 */
function sanitizeFilename(name: string): string {
  // Split name and extension
  const lastDot = name.lastIndexOf(".");
  const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;
  const extension = lastDot > 0 ? name.slice(lastDot) : "";

  // Replace spaces with dashes, remove non-alphanumeric except dash/underscore
  const sanitized = baseName
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "");

  return sanitized + extension.toLowerCase();
}

export async function uploadPhotosToStorage(
  photos: PhotoData[],
  userId: string
): Promise<UploadResult> {
  const urls: string[] = [];
  const errors: string[] = [];

  console.log(`Uploading ${photos.length} photos to Supabase Storage...`);

  const supabase = getSupabaseClient();

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    try {
      // Skip photos without File objects (already uploaded URLs)
      if (!photo.file) {
        console.log(`Photo ${i} has no file, skipping upload`);
        // If it has a preview URL that's already a Supabase URL, include it
        if (photo.preview && photo.preview.startsWith('http')) {
          urls.push(photo.preview);
        }
        continue;
      }

      // Convert photo file to blob
      const blob = photo.file;

      const timestamp = Date.now();
      const sanitizedName = sanitizeFilename(photo.name);
      const filename = `${userId}/${timestamp}-${i}-${sanitizedName}`;

      const { data, error } = await supabase.storage
        .from("property-photos")
        .upload(filename, blob, {
          contentType: photo.file.type || "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error(`Upload error for photo ${i}:`, error);
        errors.push(`Failed to upload ${photo.name}: ${error.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("property-photos")
        .getPublicUrl(data.path);

      urls.push(urlData.publicUrl);
      console.log(`Uploaded photo ${i + 1}/${photos.length}`);

    } catch (error) {
      console.error(`Error processing photo ${i}:`, error);
      errors.push(`Failed to process ${photo.name}`);
    }
  }

  console.log(`Upload complete: ${urls.length} successful, ${errors.length} failed`);
  return { urls, errors };
}
