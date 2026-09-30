/**
 * Day Book Query Service — Phase 8
 *
 * Dedicated server-side service for querying, summarizing, and presenting the daily
 * chronological journal of business events from the single-entry LedgerEntry system.
 *
 * LOCKED RULES:
 * 1. Single-entry preserved (no debit/credit pairs).
 * 2. Stored DB entries are always 100% true monetary values.
 * 3. Flow classification:
 *    PAYMENT      -> INFLOW
 *    DISBURSEMENT -> OUTFLOW
 *    CLOSURE      -> NEUTRAL
 *    ITEM_RELEASE -> NEUTRAL
 * 4. 50% calculation mode is presentation-only (halves monetary display fields, preserves metadata).
 * 5. Historical entries with accountId = NULL are safely handled as Unassigned/Legacy.
 */

import { prisma } from "@/lib/db";
import { Prisma, TransactionType } from "@prisma/client";
import { CalculationMode } from "@/lib/auth/session";
import { projectMonetaryDecimal } from "@/lib/projection";

export type CashFlowDirection = "INFLOW" | "OUTFLOW" | "NEUTRAL";

export interface DayBookFilter {
  /** Target date (Date object or YYYY-MM-DD string). Defaults to today. */
  date?: Date | string;
  /** Filter by event type: "ALL" or specific TransactionType */
  eventType?: "ALL" | TransactionType;
  /** Filter by AccountMaster ID, or "UNASSIGNED" for legacy NULL account rows */
  accountId?: string;
  /** Sort order (defaults to "asc" chronological) */
  sortOrder?: "asc" | "desc";
}

export interface DayBookEntryItem {
  id: string;
  createdAt: Date;
  type: TransactionType;
  flow: CashFlowDirection;
  amount: Prisma.Decimal;
  principalAfter: Prisma.Decimal;
  loanId: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  referenceId: string | null;
  description: string;
}

export interface DayBookSummary {
  totalInflow: Prisma.Decimal;
  totalOutflow: Prisma.Decimal;
  netCashFlow: Prisma.Decimal;
  eventCount: number;
  paymentCount: number;
  disbursementCount: number;
  closureCount: number;
  itemReleaseCount: number;
}

export interface DayBookResult {
  date: string;
  entries: DayBookEntryItem[];
  summary: DayBookSummary;
  calculationMode: CalculationMode;
}

/**
 * Classifies flow direction strictly per Phase 8 Step 4 locked business rules.
 */
export function classifyFlow(type: TransactionType): CashFlowDirection {
  switch (type) {
    case "PAYMENT":
      return "INFLOW";
    case "DISBURSEMENT":
      return "OUTFLOW";
    case "CLOSURE":
    case "ITEM_RELEASE":
    default:
      return "NEUTRAL";
  }
}

/**
 * Normalizes input date to start and end of day in local/UTC context.
 */
export function getDateRange(inputDate?: Date | string): { start: Date; end: Date; dateStr: string } {
  const d = inputDate ? new Date(inputDate) : new Date();
  if (isNaN(d.getTime())) {
    throw new Error("Invalid date provided to Day Book query.");
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  const start = new Date(d);
  start.setHours(0, 0, 0, 0);

  const end = new Date(d);
  end.setHours(23, 59, 59, 999);

  return { start, end, dateStr };
}

/**
 * Queries Day Book entries with full relational joins, flow classification,
 * KPI summary calculation, and optional 50% presentation projection.
 *
 * @param filter Query filters (date, eventType, accountId, sortOrder)
 * @param mode Calculation mode (NORMAL or FIFTY_PERCENT) for presentation
 */
export async function getDayBookEntries(
  filter: DayBookFilter = {},
  mode: CalculationMode = "NORMAL"
): Promise<DayBookResult> {
  const { start, end, dateStr } = getDateRange(filter.date);

  const where: Prisma.LedgerEntryWhereInput = {
    createdAt: {
      gte: start,
      lte: end,
    },
  };

  if (filter.eventType && filter.eventType !== "ALL") {
    where.type = filter.eventType;
  }

  if (filter.accountId) {
    if (filter.accountId === "UNASSIGNED") {
      where.accountId = null;
    } else {
      where.accountId = filter.accountId;
    }
  }

  const rawEntries = await prisma.ledgerEntry.findMany({
    where,
    orderBy: {
      createdAt: filter.sortOrder ?? "asc",
    },
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

  // Calculate 100% true KPIs
  let totalInflow = new Prisma.Decimal(0);
  let totalOutflow = new Prisma.Decimal(0);
  let paymentCount = 0;
  let disbursementCount = 0;
  let closureCount = 0;
  let itemReleaseCount = 0;

  const entries: DayBookEntryItem[] = rawEntries.map((row) => {
    const flow = classifyFlow(row.type);

    if (row.type === "PAYMENT") {
      totalInflow = totalInflow.plus(row.amount);
      paymentCount++;
    } else if (row.type === "DISBURSEMENT") {
      totalOutflow = totalOutflow.plus(row.amount);
      disbursementCount++;
    } else if (row.type === "CLOSURE") {
      closureCount++;
    } else if (row.type === "ITEM_RELEASE") {
      itemReleaseCount++;
    }

    // Apply presentation projection if in FIFTY_PERCENT mode
    const displayAmount =
      mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(row.amount, mode) : row.amount;
    const displayPrincipalAfter =
      mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(row.principalAfter, mode) : row.principalAfter;

    return {
      id: row.id,
      createdAt: row.createdAt,
      type: row.type,
      flow,
      amount: displayAmount,
      principalAfter: displayPrincipalAfter,
      loanId: row.loanId,
      loanNumber: row.loan.loanNumber,
      customerId: row.loan.customerId,
      customerName: row.loan.customer.fullName,
      customerPhone: row.loan.customer.phone,
      accountId: row.accountId,
      accountCode: row.account?.code ?? null,
      accountName: row.account?.name ?? null,
      accountType: row.account?.type ?? null,
      referenceId: row.referenceId,
      description: row.description,
    };
  });

  const netCashFlow = totalInflow.minus(totalOutflow);

  // Project KPIs for presentation if needed
  const summary: DayBookSummary = {
    totalInflow: mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(totalInflow, mode) : totalInflow,
    totalOutflow: mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(totalOutflow, mode) : totalOutflow,
    netCashFlow: mode === "FIFTY_PERCENT" ? projectMonetaryDecimal(netCashFlow, mode) : netCashFlow,
    eventCount: entries.length,
    paymentCount,
    disbursementCount,
    closureCount,
    itemReleaseCount,
  };

  return {
    date: dateStr,
    entries,
    summary,
    calculationMode: mode,
  };
}
