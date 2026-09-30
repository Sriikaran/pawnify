/**
 * Account Resolver — Phase 8
 *
 * Centralizes resolution of the configured/default active Counter Cash account
 * for automatic account-aware posting (DISBURSEMENT and PAYMENT) in Pawnify.
 *
 * DESIGN RULES (LOCKED):
 * 1. Find the configured Counter Cash account reliably.
 * 2. Ensure it exists in AccountMaster.
 * 3. Ensure it is active (isActive === true).
 * 4. Return its AccountMaster ID.
 * 5. Fail safely with a clear, descriptive business error if unavailable or inactive.
 * 6. Do NOT hardcode arbitrary database IDs.
 * 7. Do NOT silently create missing accounts.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

const STANDARD_CASH_CODES = ["CASH-01", "CASH", "COUNTER-CASH"];

/**
 * Resolves the active Counter Cash AccountMaster ID.
 *
 * Strategy:
 * 1. Check AppSetting for an explicit code override ("account.counter_cash.code" or "account.default.cash")
 * 2. If no setting exists, look up standard conventional cash codes (CASH-01, CASH, COUNTER-CASH) of type ASSET
 * 3. If still not matched, check for any active ASSET account named "Counter Cash" (case-insensitive)
 *
 * @param client Prisma client or active transaction client
 * @returns The AccountMaster ID
 * @throws Error if no Counter Cash account exists or if it is inactive
 */
export async function resolveCounterCashAccount(client: DbClient = prisma): Promise<string> {
  const account = await getCounterCashAccount(client);
  return account.id;
}

/**
 * Retrieves the full AccountMaster record for the configured Counter Cash account.
 *
 * @param client Prisma client or active transaction client
 * @returns The AccountMaster record
 * @throws Error if not configured or inactive
 */
export async function getCounterCashAccount(client: DbClient = prisma) {
  // 1. Check AppSetting override
  const setting = await client.appSetting.findFirst({
    where: {
      key: { in: ["account.counter_cash.code", "account.default.cash"] },
    },
  });

  if (setting && setting.value.trim()) {
    const configuredCode = setting.value.trim().toUpperCase();
    const account = await client.accountMaster.findFirst({
      where: {
        code: { equals: configuredCode, mode: "insensitive" },
      },
    });

    if (!account) {
      throw new Error(
        `Configured Counter Cash account with code "${configuredCode}" was not found in Account Master.`
      );
    }

    if (!account.isActive) {
      throw new Error(
        `Configured Counter Cash account "${account.name}" (${account.code}) is inactive. Please activate it before recording cash transactions.`
      );
    }

    return account;
  }

  // 2. Lookup standard conventional codes in order
  for (const code of STANDARD_CASH_CODES) {
    const account = await client.accountMaster.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        type: "ASSET",
      },
    });

    if (account) {
      if (!account.isActive) {
        throw new Error(
          `Counter Cash account "${account.name}" (${account.code}) is inactive. Please activate it before recording cash transactions.`
        );
      }
      return account;
    }
  }

  // 3. Fallback: Search for ASSET account with name containing "Counter Cash"
  const namedAccount = await client.accountMaster.findFirst({
    where: {
      name: { contains: "Counter Cash", mode: "insensitive" },
      type: "ASSET",
    },
  });

  if (namedAccount) {
    if (!namedAccount.isActive) {
      throw new Error(
        `Counter Cash account "${namedAccount.name}" (${namedAccount.code}) is inactive. Please activate it before recording cash transactions.`
      );
    }
    return namedAccount;
  }

  // 4. Missing: Fail safely with explicit business error
  throw new Error(
    "Default Counter Cash account is not configured in Account Master. Please create an active Cash account (e.g. code 'CASH-01' or name 'Counter Cash') in Account Master."
  );
}
