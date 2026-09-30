"use server";

import { checkAuth } from "@/lib/auth/session";
import { getDayBookEntries, DayBookFilter } from "@/lib/services/day-book";
import { getActiveAccounts } from "@/lib/services/accounts";
import { serializeForClient } from "@/lib/serialize";

/**
 * Server action to fetch Day Book entries for the client.
 * Enforces authentication and automatically applies session-based calculationMode projection.
 */
export async function getDayBookAction(filter?: DayBookFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const result = await getDayBookEntries(filter, auth.calculationMode);
  return serializeForClient(result);
}

/**
 * Server action to list active master accounts for the Day Book filter dropdown.
 */
export async function listAccountsForFilterAction() {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const accounts = await getActiveAccounts();
  return serializeForClient(accounts);
}
