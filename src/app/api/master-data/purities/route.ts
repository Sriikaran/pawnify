import { NextRequest, NextResponse } from "next/server";
import { getActivePurities, createCustomPurity } from "@/lib/services/master-data";
import { checkAuth } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const metalKey = searchParams.get("metalKey") || "GOLD";
    const purities = await getActivePurities(metalKey);
    return NextResponse.json({ success: true, purities });
  } catch (error) {
    console.error("GET /api/master-data/purities error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch purities" },
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
    const { metalKey, label, purityPercent, finenessCode } = body;

    if (!metalKey || !label || purityPercent === undefined) {
      return NextResponse.json(
        { success: false, error: "metalKey, label, and purityPercent are required" },
        { status: 400 }
      );
    }

    const purity = await createCustomPurity({
      metalKey,
      label,
      purityPercent: Number(purityPercent),
      finenessCode,
      createdById: auth.user.id,
    });

    return NextResponse.json({ success: true, purity });
  } catch (error) {
    console.error("POST /api/master-data/purities error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create purity",
      },
      { status: 500 }
    );
  }
}
