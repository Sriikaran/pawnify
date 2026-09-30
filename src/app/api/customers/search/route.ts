import { NextRequest, NextResponse } from "next/server";
import { searchCustomers } from "@/lib/services/customers";
import { checkAuth } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const customers = await searchCustomers(query, 10);
    return NextResponse.json(customers);
  } catch (error) {
    console.error("Customer search error:", error);
    return NextResponse.json({ error: "Failed to search customers" }, { status: 500 });
  }
}
