import { NextRequest, NextResponse } from "next/server";
import { getActiveMetals, createCustomMetal } from "@/lib/services/master-data";
import { checkAuth } from "@/lib/auth/session";

export async function GET() {
  try {
    const metals = await getActiveMetals();
    return NextResponse.json({ success: true, metals });
  } catch (error) {
    console.error("GET /api/master-data/metals error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch metals" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await checkAuth();
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { displayName } = body;
    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json(
        { success: false, error: "Display name is required" },
        { status: 400 }
      );
    }

    const metal = await createCustomMetal({
      displayName,
      createdById: auth.user.id,
    });

    return NextResponse.json({ success: true, metal });
  } catch (error) {
    console.error("POST /api/master-data/metals error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create metal" },
      { status: 500 }
    );
  }
}
