"use server";

import { checkAuth } from "@/lib/auth/session";
import { getMarketRates } from "@/lib/services/market-rates";
import { serializeForClient } from "@/lib/serialize";

export async function getMarketRatesAction() {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }
  return serializeForClient(await getMarketRates());
}
