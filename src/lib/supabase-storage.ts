import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

const DEFAULT_BUCKET = "pawnify-docs";

export async function uploadToSupabaseBucket(
  file: File | Blob | Buffer,
  fileName: string,
  bucketName: string = DEFAULT_BUCKET,
  contentType: string = "application/octet-stream"
): Promise<{ url: string; error?: string }> {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn(
        "Supabase credentials not configured in environment. Using fallback local representation."
      );
      // Fallback: If File/Blob, return Object URL or data URI representation for UI continuity
      if (typeof window !== "undefined" && (file instanceof Blob || file instanceof File)) {
        return { url: URL.createObjectURL(file) };
      }
      return { url: `/uploads/fallback/${fileName}` };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const filePath = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { data, error } = await supabase.storage.from(bucketName).upload(filePath, file, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.error("Supabase storage upload error:", error.message);
      return { url: "", error: error.message };
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown upload error";
    console.error("Storage helper error:", message);
    return { url: "", error: message };
  }
}
