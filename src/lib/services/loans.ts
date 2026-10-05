/**
 * Loan Service — Creation, Queries, Status Derivation, Closure
 *
 * Handles the full loan lifecycle from creation through closure and item release.
 * All valuations are recomputed server-side (Non-Negotiable #5).
 * Closure is a two-step process: financial close + physical item release (§6.5).
 */

import {
  Prisma,
  MetalType,
  PaymentMode,
  LoanStatus,
  InterestType,
  InterestFrequency,
  CumulativeInterestTreatment,
} from "@prisma/client";
import { prisma, runSerializable } from "@/lib/db";
import { debugLog } from "@/lib/debug";
import { addMonths } from "date-fns";
import {
  computeItemValuation,
  getLtvSlabs,
  getLtvPercent,
  computeEligibleAmount,
} from "./valuation";
import { computeTotalInterestOwed, computeInterestSummary } from "./interest";
import { writeLedgerEntry } from "@/lib/ledger-writer";
import { resolveCounterCashAccount } from "@/lib/services/account-resolver";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// ==================== Types ====================

export interface LoanItemInput {
  metalType: MetalType | string;
  description: string;
  purityLabel: string;
  purityPercent: string | number;
  grossWeightGrams: string | number;
  stoneWeightGrams: string | number;
  valuationRatePerGram: string | number;
  packetNumber: string;
  storageLocation: string;
  photoUrls?: string[];
  photoUrl?: string;
}

export interface CreateLoanInput {
  customerId: string;
  handledById: string;
  items: LoanItemInput[];
  tenureMonths: number;
  interestRateMonthly: string | number;
  principalAmount: string | number;
  gracePeriodDays?: number;
  loanDate?: Date;
  processingFee?: string | number;
  disbursementMode?: PaymentMode;
  interestType?: InterestType;
  interestFrequency?: InterestFrequency;
  cumulativePeriodMonths?: number;
  interestTreatment?: CumulativeInterestTreatment;
}

export type LoanDisplayStatus = "ACTIVE" | "OVERDUE" | "CLOSED";

// ==================== Loan Number Generation ====================

async function generateLoanNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.loan.count({
    where: {
      loanNumber: {
        startsWith: `PL-${year}`,
      },
    },
  });
  return `PL-${year}-${String(count + 1).padStart(6, "0")}`;
}

// ==================== Status Derivation ====================

/**
 * "Overdue" is derived, not stored — computed from ACTIVE status + due date + grace period.
 * This avoids needing a scheduled job and can never drift out of sync with the calendar.
 */
export function deriveLoanDisplayStatus(loan: {
  status: LoanStatus;
  dueDate: Date;
  gracePeriodDays: number;
}): LoanDisplayStatus {
  if (loan.status === "CLOSED") return "CLOSED";

  const today = new Date();
  const graceDueDate = new Date(loan.dueDate);
  graceDueDate.setDate(graceDueDate.getDate() + loan.gracePeriodDays);

  if (today > graceDueDate) return "OVERDUE";
  return "ACTIVE";
}

// ==================== Loan Creation ====================

export async function createLoan(input: CreateLoanInput) {
  const loanDate = input.loanDate || new Date();

  return await runSerializable(async (tx) => {
    // 1. Recompute all item valuations server-side (Non-Negotiable #5)
    const computedItems = input.items.map((item) => {
      const valuation = computeItemValuation({
        grossWeightGrams: item.grossWeightGrams,
        stoneWeightGrams: item.stoneWeightGrams,
        purityPercent: item.purityPercent,
        valuationRatePerGram: item.valuationRatePerGram,
      });
      return { ...item, ...valuation };
    });

    // 2. Sum assessed values
    const totalAssessedValue = computedItems.reduce(
      (sum, item) => sum.plus(item.assessedValue),
      new Decimal(0)
    );

    // 3. Determine tiered LTV
    const slabs = await getLtvSlabs();
    const ltvPercent = getLtvPercent(totalAssessedValue, slabs);
    const eligibleAmount = computeEligibleAmount(totalAssessedValue, ltvPercent);

    // 4. Validate principal ≤ eligible
    const principalAmount = new Decimal(input.principalAmount);
    if (principalAmount.gt(eligibleAmount)) {
      throw new Error(
        `Principal ₹${principalAmount.toString()} exceeds eligible amount ₹${eligibleAmount.toString()} (LTV: ${ltvPercent.toString()}%)`
      );
    }
    if (principalAmount.lte(new Decimal(0))) {
      throw new Error("Principal amount must be positive");
    }

    // 5. Compute due date
    const dueDate = addMonths(loanDate, input.tenureMonths);

    // 6. Generate loan number
    const loanNumber = await generateLoanNumber(tx);

    // 7. Create Loan
    const loan = await tx.loan.create({
      data: {
        loanNumber,
        customerId: input.customerId,
        handledById: input.handledById,
        loanDate,
        dueDate,
        tenureMonths: input.tenureMonths,
        interestRateMonthly: new Decimal(input.interestRateMonthly),
        ltvPercent,
        gracePeriodDays: input.gracePeriodDays ?? 7,
        interestType: input.interestType || "STANDARD",
        interestFrequency: input.interestFrequency || "MONTHLY",
        cumulativePeriodMonths: input.cumulativePeriodMonths || null,
        interestTreatment: input.interestTreatment || null,
        totalAssessedValue,
        principalAmount,
        principalOutstanding: principalAmount,
        lastSettledDate: loanDate,
        items: {
          create: computedItems.map((item) => {
            const metal =
              item.metalType === "GOLD" || item.metalType === "SILVER"
                ? (item.metalType as MetalType)
                : MetalType.OTHER;
            const photoUrls = item.photoUrls || (item.photoUrl ? [item.photoUrl] : []);
            const primaryPhoto = item.photoUrl || (photoUrls.length > 0 ? photoUrls[0] : null);

            return {
              metalType: metal,
              description: item.description,
              purityLabel: item.purityLabel,
              purityPercent: new Decimal(item.purityPercent),
              grossWeightGrams: new Decimal(item.grossWeightGrams),
              stoneWeightGrams: new Decimal(item.stoneWeightGrams),
              netWeightGrams: item.netWeightGrams,
              fineWeightGrams: item.fineWeightGrams,
              valuationRatePerGram: new Decimal(item.valuationRatePerGram),
              assessedValue: item.assessedValue,
              packetNumber: item.packetNumber,
              storageLocation: item.storageLocation,
              photoUrls,
              photoUrl: primaryPhoto,
            };
          }),
        },
      },
      include: { items: true },
    });

    // 8. Processing fee charge (optional)
    if (input.processingFee) {
      const fee = new Decimal(input.processingFee);
      if (fee.gt(new Decimal(0))) {
        await tx.loanCharge.create({
          data: {
            loanId: loan.id,
            chargeType: "PROCESSING_FEE",
            amount: fee,
          },
        });
      }
    }

    // 9. Disbursement ledger entry (account-aware Counter Cash posting)
    const counterCashAccountId = await resolveCounterCashAccount(tx);
    await writeLedgerEntry(tx, {
      loanId: loan.id,
      type: "DISBURSEMENT",
      amount: principalAmount,
      principalAfter: principalAmount,
      accountId: counterCashAccountId,
      description: `Loan ${loanNumber} disbursed — ₹${principalAmount.toString()} against ${computedItems.length} item(s) valued at ₹${totalAssessedValue.toString()} (LTV: ${ltvPercent.toString()}%)`,
    });

    debugLog(
      "loans",
      `createLoan: ${loanNumber} principal=${principalAmount.toString()} ltv=${ltvPercent.toString()}%`
    );

    return loan;
  });
}

// ==================== Loan Queries ====================

export async function getLoanById(id: string) {
  if (!id || id === "undefined" || id === "null") return null;

  const loan = await prisma.loan.findFirst({
    where: {
      OR: [{ id }, { loanNumber: id }],
    },
    include: {
      customer: true,
      handledBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!loan) return null;

  const actualLoanId = loan.id;

  const [items, payments, charges, transactions, followUps] = await Promise.all([
    prisma.loanItem.findMany({ where: { loanId: actualLoanId }, orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ where: { loanId: actualLoanId }, orderBy: { createdAt: "desc" } }),
    prisma.loanCharge.findMany({ where: { loanId: actualLoanId }, orderBy: { createdAt: "asc" } }),
    prisma.ledgerEntry.findMany({ where: { loanId: actualLoanId }, orderBy: { createdAt: "asc" } }),
    prisma.followUp.findMany({ where: { loanId: actualLoanId }, orderBy: { dueDate: "asc" } }),
  ]);

  const fullLoan = {
    ...loan,
    items,
    payments,
    charges,
    transactions,
    followUps,
  };

  const displayStatus = deriveLoanDisplayStatus(fullLoan);
  const interestSummary = computeInterestSummary({
    principalOutstanding: fullLoan.principalOutstanding,
    interestRateMonthly: fullLoan.interestRateMonthly,
    lastSettledDate: fullLoan.lastSettledDate,
    interestType: fullLoan.interestType,
    interestFrequency: fullLoan.interestFrequency,
    cumulativePeriodMonths: fullLoan.cumulativePeriodMonths,
    interestTreatment: fullLoan.interestTreatment,
    interestOutstanding: fullLoan.interestOutstanding,
    lastCapitalizedAt: fullLoan.lastCapitalizedAt,
  });

  const totalDue = fullLoan.principalOutstanding
    .plus(interestSummary.totalInterestOwed)
    .plus(
      fullLoan.charges
        .filter((c) => !c.isSettled)
        .reduce((sum, c) => sum.plus(c.amount), new Decimal(0))
    );

  return {
    ...fullLoan,
    displayStatus,
    interestSummary,
    totalDue,
  };
}

export interface LoanFilters {
  status?: LoanDisplayStatus;
  customerId?: string;
  search?: string; // loan number, packet number, customer name
  metalType?: MetalType;
  dateFrom?: Date;
  dateTo?: Date;
  handledById?: string;
  page?: number;
  pageSize?: number;
}

export async function getLoans(filters: LoanFilters = {}) {
  const { page = 1, pageSize = 20 } = filters;

  const where: Prisma.LoanWhereInput = {};

  // Status filter — for OVERDUE, we filter ACTIVE and then filter in-memory
  if (filters.status === "CLOSED") {
    where.status = "CLOSED";
  } else if (filters.status === "ACTIVE" || filters.status === "OVERDUE") {
    where.status = "ACTIVE";
  }

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  if (filters.handledById) {
    where.handledById = filters.handledById;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.loanDate = {};
    if (filters.dateFrom) where.loanDate.gte = filters.dateFrom;
    if (filters.dateTo) where.loanDate.lte = filters.dateTo;
  }

  if (filters.search) {
    where.OR = [
      { loanNumber: { contains: filters.search, mode: "insensitive" } },
      {
        customer: {
          OR: [
            { fullName: { contains: filters.search, mode: "insensitive" } },
            { phone: { contains: filters.search } },
          ],
        },
      },
      {
        items: {
          some: {
            packetNumber: { contains: filters.search, mode: "insensitive" },
          },
        },
      },
    ];
  }

  if (filters.metalType) {
    where.items = { some: { metalType: filters.metalType } };
  }

  const include = {
    customer: { select: { id: true, fullName: true, phone: true } },
    handledBy: { select: { id: true, name: true } },
    items: { select: { metalType: true, packetNumber: true } },
  } satisfies Prisma.LoanInclude;

  // ACTIVE vs OVERDUE is derived per-row from dueDate + gracePeriodDays (see
  // deriveLoanDisplayStatus), which Prisma's query builder can't express as a
  // WHERE clause. DB-level skip/take before that filter would return a
  // wrong/incomplete page and a total that doesn't match what's displayed, so
  // for these two statuses we fetch every matching ACTIVE loan and paginate
  // in memory instead of trusting the DB to do it.
  if (filters.status === "ACTIVE" || filters.status === "OVERDUE") {
    const allMatching = await prisma.loan.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
    });

    const filtered = allMatching
      .map((loan) => ({ ...loan, displayStatus: deriveLoanDisplayStatus(loan) }))
      .filter((l) => l.displayStatus === filters.status);

    const total = filtered.length;
    const skip = (page - 1) * pageSize;

    return {
      loans: filtered.slice(skip, skip + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  const skip = (page - 1) * pageSize;
  const [loans, total] = await Promise.all([
    prisma.loan.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.loan.count({ where }),
  ]);

  return {
    loans: loans.map((loan) => ({ ...loan, displayStatus: deriveLoanDisplayStatus(loan) })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ==================== Loan Closure (§6.5) ====================

/**
 * Close a loan. Requires principal outstanding = 0 and all charges settled.
 * Closure is a financial event — item release is a separate operational step.
 */
export async function closeLoan(loanId: string, closedById: string) {
  return await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: { charges: { where: { isSettled: false } } },
    });

    if (!loan) throw new Error("Loan not found");
    if (loan.status !== "ACTIVE") throw new Error("Loan is already closed");
    if (loan.principalOutstanding.gt(new Decimal(0))) {
      throw new Error(
        `Cannot close loan: ₹${loan.principalOutstanding.toString()} principal still outstanding`
      );
    }
    if (loan.charges.length > 0) {
      throw new Error("Cannot close loan: unsettled charges remain");
    }

    // Check if there is any outstanding interest
    const totalInterest = computeTotalInterestOwed(
      {
        principalOutstanding: loan.principalOutstanding,
        interestRateMonthly: loan.interestRateMonthly,
        lastSettledDate: loan.lastSettledDate,
        interestType: loan.interestType,
        interestFrequency: loan.interestFrequency,
        cumulativePeriodMonths: loan.cumulativePeriodMonths,
        interestTreatment: loan.interestTreatment,
        interestOutstanding: loan.interestOutstanding,
        lastCapitalizedAt: loan.lastCapitalizedAt,
        loanDate: loan.loanDate,
      },
      new Date()
    );
    if (totalInterest.gt(new Decimal("0.01"))) {
      throw new Error(`Cannot close loan: ₹${totalInterest.toString()} interest still outstanding`);
    }

    const now = new Date();

    await tx.loan.update({
      where: { id: loanId },
      data: {
        status: "CLOSED",
        closedAt: now,
        closedById,
      },
    });

    await writeLedgerEntry(tx, {
      loanId,
      type: "CLOSURE",
      amount: new Decimal(0),
      principalAfter: new Decimal(0),
      accountId: null,
      description: `Loan ${loan.loanNumber} closed — all dues settled`,
    });

    return { closedAt: now };
  });
}

/**
 * Release items — sets releasedAt on all items for a closed loan.
 * This is the physical hand-back of collateral, separate from financial closure.
 */
export async function releaseItems(loanId: string) {
  return await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: { items: true },
    });

    if (!loan) throw new Error("Loan not found");
    if (loan.status !== "CLOSED") {
      throw new Error("Cannot release items: loan is not closed");
    }

    const alreadyReleased = loan.items.every((i) => i.releasedAt !== null);
    if (alreadyReleased) {
      throw new Error("Items have already been released");
    }

    const now = new Date();

    await tx.loanItem.updateMany({
      where: { loanId, releasedAt: null },
      data: { releasedAt: now },
    });

    await writeLedgerEntry(tx, {
      loanId,
      type: "ITEM_RELEASE",
      amount: new Decimal(0),
      principalAfter: new Decimal(0),
      accountId: null,
      description: `${loan.items.length} item(s) released to customer`,
    });

    return { releasedAt: now };
  });
}

// ==================== Default Interest Rate ====================

export async function getDefaultInterestRate(): Promise<string> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "interest.default.monthly" },
  });
  return setting?.value ?? "1.500";
}

export async function getDefaultGracePeriod(): Promise<number> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "grace.period.days" },
  });
  return setting ? parseInt(setting.value) : 7;
}
