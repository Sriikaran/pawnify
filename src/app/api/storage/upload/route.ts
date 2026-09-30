import { NextRequest, NextResponse } from "next/server";
import { uploadToSupabaseBucket } from "@/lib/supabase-storage";
import { checkAuth } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || "pawnify-docs";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadToSupabaseBucket(buffer, file.name, bucket, file.type);

    if (result.error) {
      return NextResponse.json({ error: result.error, url: result.url }, { status: 500 });
    }

    return NextResponse.json({
      url: result.url,
      fileName: file.name,
      size: file.size,
      bucket,
    });
  } catch (err: unknown) {
    console.error("API Storage Upload Error:", err);
    return NextResponse.json({ error: "Failed to upload file to storage" }, { status: 500 });
  }
}
