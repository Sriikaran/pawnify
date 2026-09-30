/**
 * Reporting Service — Phase 10
 *
 * Provides authoritative read-only derived reports over the existing Pawnify
 * single-entry financial ledger and domain models.
 *
 * STRICTLY LOCKED RULES:
 * 1. Read-only derived reporting — zero state modification, no second ledger.
 * 2. Pure single-entry model — LedgerEntry remains the ONLY financial event ledger.
 * 3. No persisted account or customer or dashboard balances.
 * 4. All financial calculations use Prisma.Decimal arithmetic.
 * 5. 50% calculation mode is presentation-only (projected once at boundary).
 * 6. Historical LedgerEntry rows with accountId = NULL are handled safely.
 * 7. Payment waterfall remains 1: Unsettled Charges (incl Penal), 2: Interest, 3: Principal.
 * 8. Interest calculation uses the existing Actual/365 simple interest engine.
 */

import { prisma } from "@/lib/db";
import {
  Prisma,
  PaymentMode,
  TransactionType,
  AccountType,
  LoanStatus,
} from "@prisma/client";
import { deriveLoanDisplayStatus } from "@/lib/services/loans";
import { computeAccruedInterest } from "@/lib/services/interest";
import { classifyFlow, CashFlowDirection } from "@/lib/services/day-book";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface BaseReportFilter {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export function parseDateBounds(
  startDate?: Date | string | null,
  endDate?: Date | string | null
): { start: Date | null; end: Date | null } {
  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    const s = new Date(startDate);
    if (!isNaN(s.getTime())) {
      start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
    }
  }

  if (endDate) {
    const e = new Date(endDate);
    if (!isNaN(e.getTime())) {
      end = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999);
    }
  }

  return { start, end };
}

// ==================== 1. LOAN REGISTER ====================

export interface LoanRegisterFilter extends BaseReportFilter {
  status?: "ALL" | "ACTIVE" | "OVERDUE" | "CLOSED";
}

export interface LoanRegisterItem {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  loanDate: Date;
  dueDate: Date;
  status: LoanStatus;
  displayStatus: "ACTIVE" | "OVERDUE" | "CLOSED";
  principalAmount: Decimal;
  principalOutstanding: Decimal;
  interestRateMonthly: Decimal;
  tenureMonths: number;
  gracePeriodDays: number;
  collateralCount: number;
  collateralSummary: string;
  totalAssessedValue: Decimal;
  createdAt: Date;
}

export interface LoanRegisterResult {
  items: LoanRegisterItem[];
  summary: {
    totalLoans: number;
    totalPrincipalAmount: Decimal;
    totalPrincipalOutstanding: Decimal;
    activeCount: number;
    overdueCount: number;
    closedCount: number;
  };
}

export async function getLoanRegisterReport(
  filter: LoanRegisterFilter = {}
): Promise<LoanRegisterResult> {
  const { start, end } = parseDateBounds(filter.startDate, filter.endDate);

  const where: Prisma.LoanWhereInput = {};

  if (start && end) {
    where.loanDate = { gte: start, lte: end };
  } else if (start) {
    where.loanDate = { gte: start };
  } else if (end) {
    where.loanDate = { lte: end };
  }

  if (filter.status === "CLOSED") {
    where.status = "CLOSED";
  } else if (filter.status === "ACTIVE" || filter.status === "OVERDUE") {
    where.status = "ACTIVE";
  }

  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim();
    where.OR = [
      { loanNumber: { contains: s, mode: "insensitive" } },
      { customer: { fullName: { contains: s, mode: "insensitive" } } },
      { customer: { phone: { contains: s } } },
    ];
  }

  const loans = await prisma.loan.findMany({
    where,
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      items: {
        select: {
          id: true,
          metalType: true,
          grossWeightGrams: true,
          netWeightGrams: true,
          description: true,
        },
      },
    },
    orderBy: { loanDate: "desc" },
  });

  let totalPrincipalAmount = new Decimal(0);
  let totalPrincipalOutstanding = new Decimal(0);
  let activeCount = 0;
  let overdueCount = 0;
  let closedCount = 0;

  const items: LoanRegisterItem[] = [];

  for (const l of loans) {
    const displayStatus = deriveLoanDisplayStatus(l);

    // Apply granular status filter (ACTIVE vs OVERDUE)
    if (filter.status === "ACTIVE" && displayStatus !== "ACTIVE") continue;
    if (filter.status === "OVERDUE" && displayStatus !== "OVERDUE") continue;

    if (displayStatus === "OVERDUE") overdueCount++;
    else if (displayStatus === "ACTIVE") activeCount++;
    else if (displayStatus === "CLOSED") closedCount++;

    totalPrincipalAmount = totalPrincipalAmount.plus(l.principalAmount);
    totalPrincipalOutstanding = totalPrincipalOutstanding.plus(l.principalOutstanding);

    const metalCounts: Record<string, number> = {};
    for (const it of l.items) {
      metalCounts[it.metalType] = (metalCounts[it.metalType] || 0) + 1;
    }
    const metalStr = Object.entries(metalCounts)
      .map(([m, c]) => `${c} ${m}`)
      .join(", ");
    const collateralSummary = `${l.items.length} items${metalStr ? ` (${metalStr})` : ""}`;

    items.push({
      id: l.id,
      loanNumber: l.loanNumber,
      customerId: l.customer.id,
      customerName: l.customer.fullName,
      customerPhone: l.customer.phone,
      loanDate: l.loanDate,
      dueDate: l.dueDate,
      status: l.status,
      displayStatus,
      principalAmount: l.principalAmount,
      principalOutstanding: l.principalOutstanding,
      interestRateMonthly: l.interestRateMonthly,
      tenureMonths: l.tenureMonths,
      gracePeriodDays: l.gracePeriodDays,
      collateralCount: l.items.length,
      collateralSummary,
      totalAssessedValue: l.totalAssessedValue,
      createdAt: l.createdAt,
    });
  }

  return {
    items,
    summary: {
      totalLoans: items.length,
      totalPrincipalAmount,
      totalPrincipalOutstanding,
      activeCount,
      overdueCount,
      closedCount,
    },
  };
}

// ==================== 2. PAYMENT / COLLECTION REGISTER ====================

export interface PaymentRegisterFilter extends BaseReportFilter {
  mode?: "ALL" | PaymentMode;
}

export interface PaymentRegisterItem {
  id: string;
  paymentDate: Date;
  receiptNumber: string;
  loanId: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amountPaid: Decimal;
  allocatedCharges: Decimal;
  allocatedInterest: Decimal;
  allocatedPrincipal: Decimal;
  remainingPrincipal: Decimal;
  mode: PaymentMode;
  collectedByName: string;
  notes: string | null;
}

export interface PaymentRegisterResult {
  items: PaymentRegisterItem[];
  summary: {
    totalPayments: number;
    totalAmountPaid: Decimal;
    totalAllocatedPrincipal: Decimal;
    totalAllocatedInterest: Decimal;
    totalAllocatedCharges: Decimal;
  };
}

export async function getPaymentRegisterReport(
  filter: PaymentRegisterFilter = {}
): Promise<PaymentRegisterResult> {
  const { start, end } = parseDateBounds(filter.startDate, filter.endDate);

  const where: Prisma.PaymentWhereInput = {};

  if (start && end) {
    where.paymentDate = { gte: start, lte: end };
  } else if (start) {
    where.paymentDate = { gte: start };
  } else if (end) {
    where.paymentDate = { lte: end };
  }

  if (filter.mode && filter.mode !== "ALL") {
    where.mode = filter.mode;
  }

  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim();
    where.OR = [
      { receiptNumber: { contains: s, mode: "insensitive" } },
      { loan: { loanNumber: { contains: s, mode: "insensitive" } } },
      { loan: { customer: { fullName: { contains: s, mode: "insensitive" } } } },
      { loan: { customer: { phone: { contains: s } } } },
    ];
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      loan: {
        select: {
          id: true,
          loanNumber: true,
          principalOutstanding: true,
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      },
      collectedBy: { select: { id: true, name: true } },
    },
    orderBy: { paymentDate: "desc" },
  });

  let totalAmountPaid = new Decimal(0);
  let totalAllocatedPrincipal = new Decimal(0);
  let totalAllocatedInterest = new Decimal(0);
  let totalAllocatedCharges = new Decimal(0);

  const items: PaymentRegisterItem[] = payments.map((p) => {
    totalAmountPaid = totalAmountPaid.plus(p.amountPaid);
    totalAllocatedPrincipal = totalAllocatedPrincipal.plus(p.allocatedPrincipal);
    totalAllocatedInterest = totalAllocatedInterest.plus(p.allocatedInterest);
    totalAllocatedCharges = totalAllocatedCharges.plus(p.allocatedCharges);

    return {
      id: p.id,
      paymentDate: p.paymentDate,
      receiptNumber: p.receiptNumber,
      loanId: p.loan.id,
      loanNumber: p.loan.loanNumber,
      customerId: p.loan.customer.id,
      customerName: p.loan.customer.fullName,
      customerPhone: p.loan.customer.phone,
      amountPaid: p.amountPaid,
      allocatedCharges: p.allocatedCharges,
      allocatedInterest: p.allocatedInterest,
      allocatedPrincipal: p.allocatedPrincipal,
      remainingPrincipal: p.loan.principalOutstanding,
      mode: p.mode,
      collectedByName: p.collectedBy.name,
      notes: p.notes,
    };
  });

  return {
    items,
    summary: {
      totalPayments: items.length,
      totalAmountPaid,
      totalAllocatedPrincipal,
      totalAllocatedInterest,
      totalAllocatedCharges,
    },
  };
}

// ==================== 3. DISBURSEMENT REGISTER ====================

export interface DisbursementRegisterFilter extends BaseReportFilter {
  accountId?: string | "ALL" | "UNASSIGNED";
}

export interface DisbursementRegisterItem {
  id: string;
  disbursementDate: Date;
  loanId: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  disbursementAmount: Decimal;
  referenceId: string | null;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  interestRateMonthly: Decimal;
  tenureMonths: number;
  description: string;
}

export interface DisbursementRegisterResult {
  items: DisbursementRegisterItem[];
  summary: {
    totalDisbursements: number;
    totalDisbursedAmount: Decimal;
  };
}

export async function getDisbursementRegisterReport(
  filter: DisbursementRegisterFilter = {}
): Promise<DisbursementRegisterResult> {
  const { start, end } = parseDateBounds(filter.startDate, filter.endDate);

  const where: Prisma.LedgerEntryWhereInput = {
    type: "DISBURSEMENT",
  };

  if (start && end) {
    where.createdAt = { gte: start, lte: end };
  } else if (start) {
    where.createdAt = { gte: start };
  } else if (end) {
    where.createdAt = { lte: end };
  }

  if (filter.accountId === "UNASSIGNED") {
    where.accountId = null;
  } else if (filter.accountId && filter.accountId !== "ALL") {
    where.accountId = filter.accountId;
  }

  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim();
    where.OR = [
      { loan: { loanNumber: { contains: s, mode: "insensitive" } } },
      { loan: { customer: { fullName: { contains: s, mode: "insensitive" } } } },
      { referenceId: { contains: s, mode: "insensitive" } },
      { description: { contains: s, mode: "insensitive" } },
    ];
  }

  const entries = await prisma.ledgerEntry.findMany({
    where,
    include: {
      loan: {
        select: {
          id: true,
          loanNumber: true,
          interestRateMonthly: true,
          tenureMonths: true,
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      },
      account: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let totalDisbursedAmount = new Decimal(0);

  const items: DisbursementRegisterItem[] = entries.map((e) => {
    totalDisbursedAmount = totalDisbursedAmount.plus(e.amount);

    return {
      id: e.id,
      disbursementDate: e.createdAt,
      loanId: e.loan.id,
      loanNumber: e.loan.loanNumber,
      customerId: e.loan.customer.id,
      customerName: e.loan.customer.fullName,
      customerPhone: e.loan.customer.phone,
      disbursementAmount: e.amount,
      referenceId: e.referenceId,
      accountId: e.accountId,
      accountCode: e.account?.code ?? null,
      accountName: e.account?.name ?? null,
      interestRateMonthly: e.loan.interestRateMonthly,
      tenureMonths: e.loan.tenureMonths,
      description: e.description,
    };
  });

  return {
    items,
    summary: {
      totalDisbursements: items.length,
      totalDisbursedAmount,
    },
  };
}

// ==================== 4. OVERDUE LOANS REPORT ====================

export interface OverdueLoansFilter {
  search?: string | null;
}

export interface OverdueLoanItem {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  loanDate: Date;
  dueDate: Date;
  gracePeriodDays: number;
  daysOverdue: number;
  interestRateMonthly: Decimal;
  principalAmount: Decimal;
  principalOutstanding: Decimal;
  accruedInterest: Decimal;
  totalDue: Decimal;
}

export interface OverdueLoansResult {
  items: OverdueLoanItem[];
  summary: {
    totalOverdueLoans: number;
    totalPrincipalOutstanding: Decimal;
    totalAccruedInterest: Decimal;
    totalDue: Decimal;
  };
}

export async function getOverdueLoansReport(
  filter: OverdueLoansFilter = {}
): Promise<OverdueLoansResult> {
  const now = new Date();

  const where: Prisma.LoanWhereInput = {
    status: "ACTIVE",
  };

  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim();
    where.OR = [
      { loanNumber: { contains: s, mode: "insensitive" } },
      { customer: { fullName: { contains: s, mode: "insensitive" } } },
      { customer: { phone: { contains: s } } },
    ];
  }

  const activeLoans = await prisma.loan.findMany({
    where,
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  let totalPrincipalOutstanding = new Decimal(0);
  let totalAccruedInterest = new Decimal(0);
  let totalDue = new Decimal(0);

  const items: OverdueLoanItem[] = [];

  for (const l of activeLoans) {
    if (deriveLoanDisplayStatus(l) !== "OVERDUE") continue;

    // Days overdue = calendar difference from (dueDate + gracePeriodDays)
    const graceDueDate = new Date(l.dueDate);
    graceDueDate.setDate(graceDueDate.getDate() + l.gracePeriodDays);
    const diffMs = now.getTime() - graceDueDate.getTime();
    const daysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    // Authoritative Actual/365 simple interest engine
    const accrued = computeAccruedInterest(
      {
        principalOutstanding: l.principalOutstanding,
        interestRateMonthly: l.interestRateMonthly,
        lastSettledDate: l.lastSettledDate,
      },
      now
    );

    const loanTotalDue = l.principalOutstanding.plus(accrued);

    totalPrincipalOutstanding = totalPrincipalOutstanding.plus(l.principalOutstanding);
    totalAccruedInterest = totalAccruedInterest.plus(accrued);
    totalDue = totalDue.plus(loanTotalDue);

    items.push({
      id: l.id,
      loanNumber: l.loanNumber,
      customerId: l.customer.id,
      customerName: l.customer.fullName,
      customerPhone: l.customer.phone,
      loanDate: l.loanDate,
      dueDate: l.dueDate,
      gracePeriodDays: l.gracePeriodDays,
      daysOverdue,
      interestRateMonthly: l.interestRateMonthly,
      principalAmount: l.principalAmount,
      principalOutstanding: l.principalOutstanding,
      accruedInterest: accrued,
      totalDue: loanTotalDue,
    });
  }

  return {
    items,
    summary: {
      totalOverdueLoans: items.length,
      totalPrincipalOutstanding,
      totalAccruedInterest,
      totalDue,
    },
  };
}

// ==================== 5. CUSTOMER-WISE LOAN SUMMARY ====================

export interface CustomerWiseSummaryFilter {
  search?: string | null;
}

export interface CustomerWiseSummaryItem {
  customerId: string;
  customerName: string;
  phone: string;
  email: string | null;
  totalLoans: number;
  activeLoans: number;
  overdueLoans: number;
  closedLoans: number;
  outstandingPrincipal: Decimal;
  accruedInterest: Decimal;
  totalPayments: Decimal;
}

export interface CustomerWiseSummaryResult {
  items: CustomerWiseSummaryItem[];
  summary: {
    totalCustomers: number;
    totalLoans: number;
    totalOutstandingPrincipal: Decimal;
    totalAccruedInterest: Decimal;
    totalPayments: Decimal;
  };
}

export async function getCustomerWiseLoanSummaryReport(
  filter: CustomerWiseSummaryFilter = {}
): Promise<CustomerWiseSummaryResult> {
  const now = new Date();

  const where: Prisma.CustomerWhereInput = {};

  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim();
    where.OR = [
      { fullName: { contains: s, mode: "insensitive" } },
      { phone: { contains: s } },
      { email: { contains: s, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      loans: {
        select: {
          id: true,
          status: true,
          dueDate: true,
          gracePeriodDays: true,
          principalOutstanding: true,
          interestRateMonthly: true,
          lastSettledDate: true,
          payments: {
            select: { amountPaid: true },
          },
        },
      },
    },
    orderBy: { fullName: "asc" },
  });

  let grandLoans = 0;
  let grandOutstanding = new Decimal(0);
  let grandAccruedInterest = new Decimal(0);
  let grandPayments = new Decimal(0);

  const items: CustomerWiseSummaryItem[] = [];

  for (const c of customers) {
    let activeLoans = 0;
    let overdueLoans = 0;
    let closedLoans = 0;
    let outstandingPrincipal = new Decimal(0);
    let accruedInterest = new Decimal(0);
    let totalPayments = new Decimal(0);

    for (const l of c.loans) {
      const displayStatus = deriveLoanDisplayStatus(l);
      if (displayStatus === "OVERDUE") {
        overdueLoans++;
        outstandingPrincipal = outstandingPrincipal.plus(l.principalOutstanding);
        accruedInterest = accruedInterest.plus(
          computeAccruedInterest(
            {
              principalOutstanding: l.principalOutstanding,
              interestRateMonthly: l.interestRateMonthly,
              lastSettledDate: l.lastSettledDate,
            },
            now
          )
        );
      } else if (displayStatus === "ACTIVE") {
        activeLoans++;
        outstandingPrincipal = outstandingPrincipal.plus(l.principalOutstanding);
        accruedInterest = accruedInterest.plus(
          computeAccruedInterest(
            {
              principalOutstanding: l.principalOutstanding,
              interestRateMonthly: l.interestRateMonthly,
              lastSettledDate: l.lastSettledDate,
            },
            now
          )
        );
      } else {
        closedLoans++;
      }

      for (const p of l.payments) {
        totalPayments = totalPayments.plus(p.amountPaid);
      }
    }

    grandLoans += c.loans.length;
    grandOutstanding = grandOutstanding.plus(outstandingPrincipal);
    grandAccruedInterest = grandAccruedInterest.plus(accruedInterest);
    grandPayments = grandPayments.plus(totalPayments);

    items.push({
      customerId: c.id,
      customerName: c.fullName,
      phone: c.phone,
      email: c.email,
      totalLoans: c.loans.length,
      activeLoans,
      overdueLoans,
      closedLoans,
      outstandingPrincipal,
      accruedInterest,
      totalPayments,
    });
  }

  return {
    items,
    summary: {
      totalCustomers: items.length,
      totalLoans: grandLoans,
      totalOutstandingPrincipal: grandOutstanding,
      totalAccruedInterest: grandAccruedInterest,
      totalPayments: grandPayments,
    },
  };
}

// ==================== 6. ACCOUNT-WISE FINANCIAL SUMMARY ====================

export interface AccountWiseSummaryFilter extends BaseReportFilter {
  type?: "ALL" | AccountType;
}

export interface AccountWiseSummaryItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  isActive: boolean;
  transactionCount: number;
  totalInflow: Decimal;
  totalOutflow: Decimal;
  netMovement: Decimal;
}

export interface AccountWiseSummaryResult {
  items: AccountWiseSummaryItem[];
  summary: {
    totalAccounts: number;
    totalInflowAllAccounts: Decimal;
    totalOutflowAllAccounts: Decimal;
    netMovementAllAccounts: Decimal;
  };
}

export async function getAccountWiseFinancialSummaryReport(
  filter: AccountWiseSummaryFilter = {}
): Promise<AccountWiseSummaryResult> {
  const { start, end } = parseDateBounds(filter.startDate, filter.endDate);

  const accountWhere: Prisma.AccountMasterWhereInput = {};
  if (filter.type && filter.type !== "ALL") {
    accountWhere.type = filter.type;
  }
  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim();
    accountWhere.OR = [
      { code: { contains: s, mode: "insensitive" } },
      { name: { contains: s, mode: "insensitive" } },
    ];
  }

  const accounts = await prisma.accountMaster.findMany({
    where: accountWhere,
    orderBy: { code: "asc" },
  });

  const entryWhere: Prisma.LedgerEntryWhereInput = {};
  if (start && end) {
    entryWhere.createdAt = { gte: start, lte: end };
  } else if (start) {
    entryWhere.createdAt = { gte: start };
  } else if (end) {
    entryWhere.createdAt = { lte: end };
  }

  let grandInflow = new Decimal(0);
  let grandOutflow = new Decimal(0);

  const items: AccountWiseSummaryItem[] = [];

  for (const acc of accounts) {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        ...entryWhere,
        accountId: acc.id,
      },
      select: {
        type: true,
        amount: true,
      },
    });

    let totalInflow = new Decimal(0);
    let totalOutflow = new Decimal(0);

    for (const e of entries) {
      const flow = classifyFlow(e.type);
      if (flow === "INFLOW") {
        totalInflow = totalInflow.plus(e.amount);
      } else if (flow === "OUTFLOW") {
        totalOutflow = totalOutflow.plus(e.amount);
      }
    }

    const netMovement = totalInflow.minus(totalOutflow);
    grandInflow = grandInflow.plus(totalInflow);
    grandOutflow = grandOutflow.plus(totalOutflow);

    items.push({
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.type,
      isActive: acc.isActive,
      transactionCount: entries.length,
      totalInflow,
      totalOutflow,
      netMovement,
    });
  }

  return {
    items,
    summary: {
      totalAccounts: items.length,
      totalInflowAllAccounts: grandInflow,
      totalOutflowAllAccounts: grandOutflow,
      netMovementAllAccounts: grandInflow.minus(grandOutflow),
    },
  };
}

// ==================== 7. DAY BOOK SUMMARY ====================

export interface DayBookSummaryFilter extends BaseReportFilter {
  eventType?: "ALL" | TransactionType;
  accountId?: string | "ALL" | "UNASSIGNED";
}

export interface DayBookSummaryReportResult {
  summary: {
    totalInflow: Decimal;
    totalOutflow: Decimal;
    netCashFlow: Decimal;
    eventCount: number;
    paymentCount: number;
    disbursementCount: number;
    closureCount: number;
    itemReleaseCount: number;
  };
  startDate: string | null;
  endDate: string | null;
}

export async function getDayBookSummaryReport(
  filter: DayBookSummaryFilter = {}
): Promise<DayBookSummaryReportResult> {
  const { start, end } = parseDateBounds(filter.startDate, filter.endDate);

  const where: Prisma.LedgerEntryWhereInput = {};
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

  if (filter.accountId === "UNASSIGNED") {
    where.accountId = null;
  } else if (filter.accountId && filter.accountId !== "ALL") {
    where.accountId = filter.accountId;
  }

  const entries = await prisma.ledgerEntry.findMany({
    where,
    select: {
      type: true,
      amount: true,
    },
  });

  let totalInflow = new Decimal(0);
  let totalOutflow = new Decimal(0);
  let paymentCount = 0;
  let disbursementCount = 0;
  let closureCount = 0;
  let itemReleaseCount = 0;

  for (const e of entries) {
    const flow = classifyFlow(e.type);
    if (flow === "INFLOW") {
      totalInflow = totalInflow.plus(e.amount);
    } else if (flow === "OUTFLOW") {
      totalOutflow = totalOutflow.plus(e.amount);
    }

    if (e.type === "PAYMENT") paymentCount++;
    else if (e.type === "DISBURSEMENT") disbursementCount++;
    else if (e.type === "CLOSURE") closureCount++;
    else if (e.type === "ITEM_RELEASE") itemReleaseCount++;
  }

  return {
    summary: {
      totalInflow,
      totalOutflow,
      netCashFlow: totalInflow.minus(totalOutflow),
      eventCount: entries.length,
      paymentCount,
      disbursementCount,
      closureCount,
      itemReleaseCount,
    },
    startDate: start ? start.toISOString() : null,
    endDate: end ? end.toISOString() : null,
  };
}

// ==================== 8. PORTFOLIO SUMMARY ====================

export interface PortfolioSummaryFilter {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export interface PortfolioSummaryResult {
  // Point-in-time metrics
  pointInTime: {
    totalLoanCount: number;
    activeLoanCount: number;
    overdueLoanCount: number;
    closedLoanCount: number;
    principalDisbursedTotal: Decimal;
    principalOutstandingTotal: Decimal;
    accruedInterestTotal: Decimal;
    totalExposure: Decimal;
    goldLoansCount: number;
    silverLoansCount: number;
    goldAssessedValue: Decimal;
    silverAssessedValue: Decimal;
  };
  // Period metrics
  period: {
    startDate: string | null;
    endDate: string | null;
    disbursementsCount: number;
    disbursementsAmount: Decimal;
    collectionsCount: number;
    collectionsAmount: Decimal;
    principalCollected: Decimal;
    interestCollected: Decimal;
    chargesCollected: Decimal;
  };
}

export async function getPortfolioSummaryReport(
  filter: PortfolioSummaryFilter = {}
): Promise<PortfolioSummaryResult> {
  const now = new Date();
  const { start, end } = parseDateBounds(filter.startDate, filter.endDate);

  // 1. Authoritative Point-in-time active loans
  const allLoans = await prisma.loan.findMany({
    include: {
      items: { select: { metalType: true, assessedValue: true } },
    },
  });

  let activeLoanCount = 0;
  let overdueLoanCount = 0;
  let closedLoanCount = 0;
  let principalDisbursedTotal = new Decimal(0);
  let principalOutstandingTotal = new Decimal(0);
  let accruedInterestTotal = new Decimal(0);

  let goldLoansCount = 0;
  let silverLoansCount = 0;
  let goldAssessedValue = new Decimal(0);
  let silverAssessedValue = new Decimal(0);

  for (const l of allLoans) {
    principalDisbursedTotal = principalDisbursedTotal.plus(l.principalAmount);
    const displayStatus = deriveLoanDisplayStatus(l);

    if (displayStatus === "CLOSED") {
      closedLoanCount++;
    } else {
      principalOutstandingTotal = principalOutstandingTotal.plus(l.principalOutstanding);
      const accrued = computeAccruedInterest(
        {
          principalOutstanding: l.principalOutstanding,
          interestRateMonthly: l.interestRateMonthly,
          lastSettledDate: l.lastSettledDate,
        },
        now
      );
      accruedInterestTotal = accruedInterestTotal.plus(accrued);

      if (displayStatus === "OVERDUE") {
        overdueLoanCount++;
      } else {
        activeLoanCount++;
      }
    }

    const hasGold = l.items.some((i) => i.metalType === "GOLD");
    const hasSilver = l.items.some((i) => i.metalType === "SILVER");

    if (hasGold) {
      goldLoansCount++;
      goldAssessedValue = goldAssessedValue.plus(l.totalAssessedValue);
    }
    if (hasSilver && !hasGold) {
      silverLoansCount++;
      silverAssessedValue = silverAssessedValue.plus(l.totalAssessedValue);
    }
  }

  // 2. Period metrics
  const disbursementWhere: Prisma.LoanWhereInput = {};
  if (start && end) disbursementWhere.loanDate = { gte: start, lte: end };
  else if (start) disbursementWhere.loanDate = { gte: start };
  else if (end) disbursementWhere.loanDate = { lte: end };

  const paymentWhere: Prisma.PaymentWhereInput = {};
  if (start && end) paymentWhere.paymentDate = { gte: start, lte: end };
  else if (start) paymentWhere.paymentDate = { gte: start };
  else if (end) paymentWhere.paymentDate = { lte: end };

  const [disbAgg, payAgg] = await Promise.all([
    prisma.loan.aggregate({
      where: Object.keys(disbursementWhere).length > 0 ? disbursementWhere : undefined,
      _sum: { principalAmount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: Object.keys(paymentWhere).length > 0 ? paymentWhere : undefined,
      _sum: {
        amountPaid: true,
        allocatedPrincipal: true,
        allocatedInterest: true,
        allocatedCharges: true,
      },
      _count: true,
    }),
  ]);

  return {
    pointInTime: {
      totalLoanCount: allLoans.length,
      activeLoanCount,
      overdueLoanCount,
      closedLoanCount,
      principalDisbursedTotal,
      principalOutstandingTotal,
      accruedInterestTotal,
      totalExposure: principalOutstandingTotal.plus(accruedInterestTotal),
      goldLoansCount,
      silverLoansCount,
      goldAssessedValue,
      silverAssessedValue,
    },
    period: {
      startDate: start ? start.toISOString() : null,
      endDate: end ? end.toISOString() : null,
      disbursementsCount: disbAgg._count,
      disbursementsAmount: disbAgg._sum.principalAmount ?? new Decimal(0),
      collectionsCount: payAgg._count,
      collectionsAmount: payAgg._sum.amountPaid ?? new Decimal(0),
      principalCollected: payAgg._sum.allocatedPrincipal ?? new Decimal(0),
      interestCollected: payAgg._sum.allocatedInterest ?? new Decimal(0),
      chargesCollected: payAgg._sum.allocatedCharges ?? new Decimal(0),
    },
  };
}

// ==================== 9. TRANSACTION HISTORY ====================

export interface TransactionHistoryFilter extends BaseReportFilter {
  type?: "ALL" | TransactionType;
  eventType?: "ALL" | TransactionType;
  accountId?: string | "ALL" | "UNASSIGNED";
}

export interface TransactionHistoryItem {
  id: string;
  createdAt: Date;
  type: TransactionType;
  flow: CashFlowDirection;
  amount: Decimal;
  principalAfter: Decimal;
  loanId: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  referenceId: string | null;
  description: string;
}

export interface TransactionHistoryResult {
  items: TransactionHistoryItem[];
  summary: {
    totalTransactions: number;
    totalInflow: Decimal;
    totalOutflow: Decimal;
    netMovement: Decimal;
  };
}

export async function getTransactionHistoryReport(
  filter: TransactionHistoryFilter = {}
): Promise<TransactionHistoryResult> {
  const { start, end } = parseDateBounds(filter.startDate, filter.endDate);

  const where: Prisma.LedgerEntryWhereInput = {};

  if (start && end) {
    where.createdAt = { gte: start, lte: end };
  } else if (start) {
    where.createdAt = { gte: start };
  } else if (end) {
    where.createdAt = { lte: end };
  }

  const selectedType = filter.type ?? filter.eventType;
  if (selectedType && selectedType !== "ALL") {
    where.type = selectedType;
  }

  if (filter.accountId === "UNASSIGNED") {
    where.accountId = null;
  } else if (filter.accountId && filter.accountId !== "ALL") {
    where.accountId = filter.accountId;
  }

  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim();
    where.OR = [
      { loan: { loanNumber: { contains: s, mode: "insensitive" } } },
      { loan: { customer: { fullName: { contains: s, mode: "insensitive" } } } },
      { referenceId: { contains: s, mode: "insensitive" } },
      { description: { contains: s, mode: "insensitive" } },
    ];
  }

  const entries = await prisma.ledgerEntry.findMany({
    where,
    include: {
      loan: {
        select: {
          id: true,
          loanNumber: true,
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      },
      account: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let totalInflow = new Decimal(0);
  let totalOutflow = new Decimal(0);

  const items: TransactionHistoryItem[] = entries.map((e) => {
    const flow = classifyFlow(e.type);
    if (flow === "INFLOW") totalInflow = totalInflow.plus(e.amount);
    else if (flow === "OUTFLOW") totalOutflow = totalOutflow.plus(e.amount);

    return {
      id: e.id,
      createdAt: e.createdAt,
      type: e.type,
      flow,
      amount: e.amount,
      principalAfter: e.principalAfter,
      loanId: e.loan.id,
      loanNumber: e.loan.loanNumber,
      customerId: e.loan.customer.id,
      customerName: e.loan.customer.fullName,
      customerPhone: e.loan.customer.phone,
      accountId: e.accountId,
      accountCode: e.account?.code ?? null,
      accountName: e.account?.name ?? null,
      referenceId: e.referenceId,
      description: e.description,
    };
  });

  return {
    items,
    summary: {
      totalTransactions: items.length,
      totalInflow,
      totalOutflow,
      netMovement: totalInflow.minus(totalOutflow),
    },
  };
}
