import { NextRequest, NextResponse } from "next/server";
import { fetchAndSaveLiveMetalRates } from "@/lib/services/market-rates";

function isAuthorizedCronRequest(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return true;
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await fetchAndSaveLiveMetalRates();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await fetchAndSaveLiveMetalRates();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
