"use server";

import { checkAuth } from "@/lib/auth/session";
import { getDayBookEntries, DayBookFilter } from "@/lib/services/day-book";
import { getActiveAccounts } from "@/lib/services/accounts";
import { serializeForClient } from "@/lib/serialize";

/**
 * Server action to fetch Day Book entries for the client.
 * Enforces authentication and automatically applies session-based calculationMode projection.
 *
 * Date-range validation rules:
 * - If startDate is provided, endDate must also be provided (and vice-versa).
 * - startDate must be ≤ endDate.
 * - Either startDate+endDate OR date (single), never mixed.
 */
export async function getDayBookAction(filter?: DayBookFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  // Validate date-range inputs when the caller opts into range mode
  if (filter?.startDate || filter?.endDate) {
    if (!filter.startDate) {
      throw new Error("From date is required when To date is specified.");
    }
    if (!filter.endDate) {
      throw new Error("To date is required when From date is specified.");
    }

    const s = new Date(filter.startDate as string);
    const e = new Date(filter.endDate as string);

    if (isNaN(s.getTime())) {
      throw new Error("From date is invalid. Please enter a valid date.");
    }
    if (isNaN(e.getTime())) {
      throw new Error("To date is invalid. Please enter a valid date.");
    }
    if (s > e) {
      throw new Error("From date cannot be after To date. Please fix the date range.");
    }
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
