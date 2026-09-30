"use server";

import { checkAuth } from "@/lib/auth/session";
import { getAccountLedger, AccountLedgerFilter } from "@/lib/services/account-ledger";
import { prisma } from "@/lib/db";
import { serializeForClient } from "@/lib/serialize";

/**
 * Server action to fetch Account Ledger entries for the client.
 * Enforces authentication and applies session-based calculationMode projection.
 */
export async function getAccountLedgerAction(filter: AccountLedgerFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
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
