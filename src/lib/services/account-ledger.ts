/**
 * Account Ledger Service — Phase 9
 *
 * Dedicated server-side service for deriving an Account Ledger view on top
 * of the existing single-entry LedgerEntry system.
 *
 * DESIGN RULES (STRICTLY LOCKED):
 * 1. Single-entry model preserved (no debit/credit pairs, no second ledger).
 * 2. Pure derivation from AccountMaster -> LedgerEntry.accountId -> chronological entries.
 * 3. Never stores balances in the database or AccountMaster.
 * 4. Opening, running, and closing balances are calculated dynamically using Prisma.Decimal.
 * 5. Flow classification:
 *    PAYMENT      -> INFLOW (+ balance)
 *    DISBURSEMENT -> OUTFLOW (- balance)
 *    CLOSURE      -> NEUTRAL (no balance change)
 *    ITEM_RELEASE -> NEUTRAL (no balance change)
 * 6. Historical entries with accountId = NULL are excluded from account ledgers.
 * 7. Inactive accounts can still be viewed historically (inactivity only blocks new posting).
 * 8. 50% mode is presentation-only (projects monetary fields at presentation boundary).
 */

import { prisma } from "@/lib/db";
import { Prisma, TransactionType } from "@prisma/client";
import { CalculationMode } from "@/lib/auth/session";
import { projectMonetaryDecimal } from "@/lib/projection";
import { classifyFlow, CashFlowDirection } from "@/lib/services/day-book";

export interface AccountLedgerFilter {
  /** AccountMaster ID (Required) */
  accountId: string;
  /** Start date filter (inclusive) */
  startDate?: Date | string | null;
  /** End date filter (inclusive) */
  endDate?: Date | string | null;
  /** Filter by event type: "ALL" or specific TransactionType */
  eventType?: "ALL" | TransactionType;
  /** Optional search query (matches loan number, customer name, reference, or description) */
  search?: string;
  /** Sort order (defaults to "asc" chronological) */
  sortOrder?: "asc" | "desc";
}

export interface AccountLedgerItem {
  id: string;
  createdAt: Date;
  type: TransactionType;
  flow: CashFlowDirection;
  amount: Prisma.Decimal;
  principalAfter: Prisma.Decimal;
  runningBalance: Prisma.Decimal;
  loanId: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  referenceId: string | null;
  description: string;
}

export interface AccountLedgerSummary {
  openingBalance: Prisma.Decimal;
  totalInflow: Prisma.Decimal;
  totalOutflow: Prisma.Decimal;
  netMovement: Prisma.Decimal;
  closingBalance: Prisma.Decimal;
  transactionCount: number;
  paymentCount: number;
  disbursementCount: number;
  closureCount: number;
  itemReleaseCount: number;
}

export interface AccountLedgerResult {
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
    isActive: boolean;
    description: string | null;
  };
  startDate: string | null;
  endDate: string | null;
  entries: AccountLedgerItem[];
  summary: AccountLedgerSummary;
  calculationMode: CalculationMode;
}

/**
 * Normalizes optional start and end date bounds.
 */
export function normalizeDateBounds(
  startDate?: Date | string | null,
  endDate?: Date | string | null
): { start: Date | null; end: Date | null; startStr: string | null; endStr: string | null } {
  let start: Date | null = null;
  let startStr: string | null = null;
  if (startDate) {
    const d = new Date(startDate);
    if (isNaN(d.getTime())) {
      throw new Error("Invalid start date provided to Account Ledger query.");
    }
    d.setHours(0, 0, 0, 0);
    start = d;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    startStr = `${y}-${m}-${day}`;
  }

  let end: Date | null = null;
  let endStr: string | null = null;
  if (endDate) {
    const d = new Date(endDate);
    if (isNaN(d.getTime())) {
      throw new Error("Invalid end date provided to Account Ledger query.");
    }
    d.setHours(23, 59, 59, 999);
    end = d;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    endStr = `${y}-${m}-${day}`;
  }

  return { start, end, startStr, endStr };
}

/**
 * Derives the opening balance for an account prior to the given start date.
 * Uses exact Prisma.Decimal aggregation without loading prior historical rows.
 */
export async function calculateOpeningBalance(
  accountId: string,
  startDate: Date | null
): Promise<Prisma.Decimal> {
  if (!startDate) {
    return new Prisma.Decimal(0);
  }

  const [paymentAgg, disbursementAgg] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: {
        accountId,
        type: "PAYMENT",
        createdAt: { lt: startDate },
      },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        accountId,
        type: "DISBURSEMENT",
        createdAt: { lt: startDate },
      },
      _sum: { amount: true },
    }),
  ]);

  const priorInflow = paymentAgg._sum.amount ?? new Prisma.Decimal(0);
  const priorOutflow = disbursementAgg._sum.amount ?? new Prisma.Decimal(0);

  return priorInflow.minus(priorOutflow);
}

/**
 * Queries the Account Ledger for a specific AccountMaster account.
 *
 * @param filter AccountLedgerFilter with accountId, date range, eventType, etc.
 * @param mode CalculationMode ("NORMAL" or "FIFTY_PERCENT")
 */
export async function getAccountLedger(
  filter: AccountLedgerFilter,
  mode: CalculationMode = "NORMAL"
): Promise<AccountLedgerResult> {
  if (!filter.accountId || typeof filter.accountId !== "string" || !filter.accountId.trim()) {
    throw new Error("An account ID must be provided to query the Account Ledger.");
  }

  const accountId = filter.accountId.trim();

  // 1. Verify account exists in AccountMaster
  const account = await prisma.accountMaster.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      isActive: true,
      description: true,
    },
  });

  if (!account) {
    throw new Error(`Account not found with ID "${accountId}".`);
  }

  // 2. Normalize date range bounds
  const { start, end, startStr, endStr } = normalizeDateBounds(filter.startDate, filter.endDate);

  // 3. Compute Opening Balance (prior to start date) using exact Prisma.Decimal aggregation
  const openingBalance = await calculateOpeningBalance(accountId, start);

  // 4. Build query for period entries
  const where: Prisma.LedgerEntryWhereInput = {
    accountId,
  };

  if (start && end) {
    where.createdAt = { gte: start, lte: end };
  } else if (start) {
    where.createdAt = { gte: start };
  } else if (end) {
    where.createdAt = { lte: end };
  }

  if (filter.eventType && filter.eventType !== "ALL") {
    where.type = filter.eventType;
  }

  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { loan: { loanNumber: { contains: q, mode: "insensitive" } } },
      { loan: { customer: { fullName: { contains: q, mode: "insensitive" } } } },
      { referenceId: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  // Always fetch in chronological ascending order to compute running balance correctly
  const rawEntries = await prisma.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      loan: {
        select: {
          id: true,
          loanNumber: true,
          customerId: true,
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
        },
      },
      account: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
        },
      },
    },
  });

  // 5. Calculate cumulative running balance and period KPIs using Prisma.Decimal
  let currentBalance = new Prisma.Decimal(openingBalance);
  let totalInflow = new Prisma.Decimal(0);
  let totalOutflow = new Prisma.Decimal(0);
  let paymentCount = 0;
  let disbursementCount = 0;
  let closureCount = 0;
  let itemReleaseCount = 0;

  const entries: AccountLedgerItem[] = rawEntries.map((row) => {
    const flow = classifyFlow(row.type);

    if (row.type === "PAYMENT") {
      totalInflow = totalInflow.plus(row.amount);
      currentBalance = currentBalance.plus(row.amount);
      paymentCount++;
    } else if (row.type === "DISBURSEMENT") {
      totalOutflow = totalOutflow.plus(row.amount);
      currentBalance = currentBalance.minus(row.amount);
      disbursementCount++;
    } else if (row.type === "CLOSURE") {
      closureCount++;
      // NEUTRAL: no balance change
    } else if (row.type === "ITEM_RELEASE") {
      itemReleaseCount++;
      // NEUTRAL: no balance change
    }

    // Capture running balance at this point in time
    const runningBalance = currentBalance;

    // Apply 50% presentation projection if session mode is FIFTY_PERCENT
    const displayAmount =
      mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(row.amount, mode) : row.amount;
    const displayPrincipalAfter =
      mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(row.principalAfter, mode) : row.principalAfter;
    const displayRunningBalance =
      mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(runningBalance, mode) : runningBalance;

    return {
      id: row.id,
      createdAt: row.createdAt,
      type: row.type,
      flow,
      amount: displayAmount,
      principalAfter: displayPrincipalAfter,
      runningBalance: displayRunningBalance,
      loanId: row.loanId,
      loanNumber: row.loan.loanNumber,
      customerId: row.loan.customerId,
      customerName: row.loan.customer.fullName,
      customerPhone: row.loan.customer.phone,
      accountId: row.accountId!,
      accountCode: row.account?.code ?? account.code,
      accountName: row.account?.name ?? account.name,
      accountType: row.account?.type ?? account.type,
      referenceId: row.referenceId,
      description: row.description,
    };
  });

  // If client requested desc order for display, reverse the array (runningBalance on each row is preserved)
  if (filter.sortOrder === "desc") {
    entries.reverse();
  }

  const netMovement = totalInflow.minus(totalOutflow);
  const closingBalance = openingBalance.plus(netMovement);

  // 6. Build summary, projecting monetary fields only for presentation
  const summary: AccountLedgerSummary = {
    openingBalance:
      mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(openingBalance, mode) : openingBalance,
    totalInflow:
      mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(totalInflow, mode) : totalInflow,
    totalOutflow:
      mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(totalOutflow, mode) : totalOutflow,
    netMovement:
      mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(netMovement, mode) : netMovement,
    closingBalance:
      mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(closingBalance, mode) : closingBalance,
    transactionCount: entries.length,
    paymentCount,
    disbursementCount,
    closureCount,
    itemReleaseCount,
  };

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      isActive: account.isActive,
      description: account.description,
    },
    startDate: startStr,
    endDate: endStr,
    entries,
    summary,
    calculationMode: mode,
  };
}
