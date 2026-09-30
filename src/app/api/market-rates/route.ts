import { NextResponse } from "next/server";
import { getMarketRates } from "@/lib/services/market-rates";

/**
 * GET handler to return currently cached market rates and valuation formulas from system settings.
 */
export async function GET() {
  try {
    const rates = await getMarketRates();
    return NextResponse.json({ success: true, rates }, { status: 200 });
  } catch (err) {
    console.error("Failed to fetch market rates:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch market rates" },
      { status: 500 }
    );
  }
}
