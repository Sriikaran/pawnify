"use server";

import { checkAuth } from "@/lib/auth/session";
import { getAccountLedger, AccountLedgerFilter } from "@/lib/services/account-ledger";
import { prisma } from "@/lib/db";
import { serializeForClient } from "@/lib/serialize";

/**
 * Server action to fetch Account Ledger entries for the client.
 * Enforces authentication and applies session-based calculationMode projection.
 *
 * Date validation rules:
 * - If startDate is provided, endDate must also be provided (and vice-versa).
 * - Dates must be valid calendar dates.
 * - startDate must be <= endDate.
 */
export async function getAccountLedgerAction(filter: AccountLedgerFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

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

  const result = await getAccountLedger(filter, auth.calculationMode);
  return serializeForClient(result);
}

/**
 * Server action to list all accounts for the Account Ledger selector.
 * Returns both active and inactive accounts so historical ledgers remain accessible.
 */
export async function listAccountsForLedgerSelectorAction() {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const accounts = await prisma.accountMaster.findMany({
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      isActive: true,
    },
  });

  return serializeForClient(accounts);
}
