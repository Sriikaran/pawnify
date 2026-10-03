/**
 * Payment Service — §6.4 (Extended with Payment Types)
 *
 * Implements the payment allocation waterfall within an atomic DB transaction.
 * Every payment write is one atomic prisma.$transaction — a partially-applied
 * payment is a data-integrity incident, not a bug (Non-Negotiable #2).
 *
 * Payment Types:
 *   FULL:           Standard waterfall — charges → interest → principal.
 *                   Auto-closes loan if principal reaches 0 and all charges/interest settled.
 *   INTEREST_ONLY:  Reduces interest only. Principal unchanged.
 *   PRINCIPAL_ONLY: Reduces principal only. Unpaid interest remains due.
 *   PART_PAYMENT:   Standard waterfall, does NOT close the loan automatically.
 *   CLOSURE:        Full settlement + triggers loan closure.
 *   EARLY_CLOSURE:  Full settlement with early closure (same as CLOSURE financially).
 *
 * Historical compatibility:
 *   Existing payments have paymentType = FULL (schema default). No behavior change.
 *
 * 50% Mode:
 *   All monetary values stored at TRUE 100%. The caller (server action) is responsible
 *   for inverting the input if in FIFTY_PERCENT mode before calling this service.
 */

import { Prisma, PaymentMode, PaymentType } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { prisma, runSerializable } from "@/lib/db";
import { debugLog } from "@/lib/debug";
import { evaluateCumulativeLoan } from "./interest";
import { writeLedgerEntry } from "@/lib/ledger-writer";
import { resolveCounterCashAccount } from "@/lib/services/account-resolver";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface PaymentAllocation {
  allocatedCharges: Decimal;
  allocatedInterest: Decimal;
  allocatedPrincipal: Decimal;
  remainingPrincipal: Decimal;
  remainingInterest: Decimal;
  chargeDetails: Array<{ chargeId: string; amount: Decimal; settled: boolean }>;
}

export interface PaymentResult {
  paymentId: string;
  receiptNumber: string;
  allocation: PaymentAllocation;
  loanFullyPaid: boolean;
}

/**
 * Generate a receipt number: REC-YYYYMMDD-XXXXX
 */
async function generateReceiptNumber(tx: Prisma.TransactionClient): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await tx.payment.count({
    where: {
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      },
    },
  });
  return `REC-${dateStr}-${String(count + 1).padStart(5, "0")}`;
}

/**
 * Preview the allocation waterfall without persisting anything.
 * Used to show the breakdown before the user confirms payment.
 */
export async function previewPaymentAllocation(
  loanId: string,
  amountPaid: string | number,
  paymentTypeOrDate?: PaymentType | Date,
  asOfDateParam?: Date
): Promise<
  PaymentAllocation & {
    accruedInterest: Decimal;
    totalDue: Decimal;
    totalInterestOwed: Decimal;
    principalOutstanding: Decimal;
  }
> {
  let paymentType: PaymentType = "FULL";
  let asOfDate: Date = asOfDateParam ?? new Date();

  if (paymentTypeOrDate instanceof Date) {
    asOfDate = paymentTypeOrDate;
    paymentType = "FULL";
  } else if (typeof paymentTypeOrDate === "string") {
    paymentType = paymentTypeOrDate as PaymentType;
  }
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      charges: {
        where: { isSettled: false },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!loan) throw new Error("Loan not found");
  if (loan.status !== "ACTIVE") throw new Error("Loan is not active");

  const amount = new Decimal(amountPaid);

  // Compute fresh accrued interest and effective principal (accounting for cumulative capitalization)
  const evalResult = evaluateCumulativeLoan(
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
    asOfDate
  );

  const effectivePrincipal = evalResult.effectivePrincipal;
  const accruedInterest = evalResult.accruedInterestInCurrentPeriod;
  const totalInterestOwed = evalResult.totalInterestOwed;

  const allocation = computeAllocation({
    amount,
    paymentType,
    charges: loan.charges,
    accruedInterest,
    totalInterestOwed,
    principalOutstanding: effectivePrincipal,
    interestTreatment: loan.interestTreatment ?? null,
  });

  const totalCharges = loan.charges.reduce((sum, c) => sum.plus(c.amount), new Decimal(0));
  const totalDue = totalCharges.plus(totalInterestOwed).plus(effectivePrincipal);

  return {
    ...allocation,
    accruedInterest,
    totalInterestOwed,
    totalDue,
    principalOutstanding: effectivePrincipal,
  };
}

// ==================== Allocation Logic ====================

interface AllocationInput {
  amount: Decimal;
  paymentType: PaymentType;
  charges: Array<{ id: string; amount: Decimal }>;
  accruedInterest: Decimal;
  totalInterestOwed: Decimal;
  principalOutstanding: Decimal;
  interestTreatment: string | null;
}

interface AllocationOutput {
  allocatedCharges: Decimal;
  allocatedInterest: Decimal;
  allocatedPrincipal: Decimal;
  remainingPrincipal: Decimal;
  remainingInterest: Decimal;
  chargeDetails: Array<{ chargeId: string; amount: Decimal; settled: boolean }>;
}

function computeAllocation(input: AllocationInput): AllocationOutput {
  const { amount, paymentType, charges, totalInterestOwed, principalOutstanding } = input;
  let remaining = amount;

  let allocatedCharges = new Decimal(0);
  let allocatedInterest = new Decimal(0);
  let allocatedPrincipal = new Decimal(0);
  const chargeDetails: AllocationOutput["chargeDetails"] = [];

  switch (paymentType) {
    case "INTEREST_ONLY": {
      // Reduce interest only. Principal unchanged. No charge allocation.
      allocatedInterest = Decimal.min(remaining, totalInterestOwed);
      remaining = remaining.minus(allocatedInterest);
      break;
    }

    case "PRINCIPAL_ONLY": {
      // Reduce principal only. Unpaid interest remains. No charge allocation here.
      allocatedPrincipal = Decimal.min(remaining, principalOutstanding);
      remaining = remaining.minus(allocatedPrincipal);
      break;
    }

    case "FULL":
    case "PART_PAYMENT":
    case "CLOSURE":
    case "EARLY_CLOSURE":
    default: {
      // Standard waterfall: charges → interest → principal
      for (const charge of charges) {
        if (remaining.lte(new Decimal(0))) break;
        const pay = Decimal.min(remaining, charge.amount);
        allocatedCharges = allocatedCharges.plus(pay);
        remaining = remaining.minus(pay);
        chargeDetails.push({
          chargeId: charge.id,
          amount: pay,
          settled: pay.gte(charge.amount),
        });
      }

      allocatedInterest = Decimal.min(remaining, totalInterestOwed);
      remaining = remaining.minus(allocatedInterest);

      allocatedPrincipal = Decimal.min(remaining, principalOutstanding);
      remaining = remaining.minus(allocatedPrincipal);
      break;
    }
  }

  const remainingPrincipal = principalOutstanding.minus(allocatedPrincipal);
  const remainingInterest = totalInterestOwed.minus(allocatedInterest);

  return {
    allocatedCharges,
    allocatedInterest,
    allocatedPrincipal,
    remainingPrincipal: remainingPrincipal.isNegative() ? new Decimal(0) : remainingPrincipal,
    remainingInterest: remainingInterest.isNegative() ? new Decimal(0) : remainingInterest,
    chargeDetails,
  };
}

// ==================== Record Payment ====================

/**
 * Record a payment with atomic waterfall allocation.
 * ALL mutations happen inside a single prisma.$transaction.
 */
export async function recordPayment(
  loanId: string,
  amountPaid: string | number,
  mode: PaymentMode,
  collectedById: string,
  notes?: string,
  asOfDate: Date = new Date(),
  paymentType: PaymentType = "FULL"
): Promise<PaymentResult> {
  const amount = new Decimal(amountPaid);

  if (amount.lte(new Decimal(0))) {
    throw new Error("Payment amount must be positive");
  }

  debugLog(
    "payments",
    `recordPayment: loan=${loanId} amount=${amount.toString()} mode=${mode} type=${paymentType}`
  );

  return await runSerializable(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: {
        charges: {
          where: { isSettled: false },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!loan) throw new Error("Loan not found");
    if (loan.status !== "ACTIVE") throw new Error("Loan is not active");

    // ===== Evaluate interest & cumulative capitalization =====
    const evalResult = evaluateCumulativeLoan(
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
      asOfDate
    );

    let currentPrincipal = loan.principalOutstanding;
    let currentLastCapitalizedAt = loan.lastCapitalizedAt;
    let currentLastSettledDate = loan.lastSettledDate;
    let currentInterestOutstanding = loan.interestOutstanding ?? new Decimal(0);

    if (loan.interestType === "CUMULATIVE" && evalResult.periodsElapsed > 0) {
      if (loan.interestTreatment === "ADD_TO_CAPITAL") {
        currentPrincipal = evalResult.effectivePrincipal;
        currentLastCapitalizedAt = evalResult.lastBoundaryDate;
        currentLastSettledDate = evalResult.lastBoundaryDate;
      } else if (loan.interestTreatment === "KEEP_SEPARATE") {
        currentInterestOutstanding = evalResult.periodicInterestOutstanding;
        currentLastCapitalizedAt = evalResult.lastBoundaryDate;
        currentLastSettledDate = evalResult.lastBoundaryDate;
      }
    }

    const accruedInterest = evalResult.accruedInterestInCurrentPeriod;
    const totalInterestOwed = evalResult.totalInterestOwed;

    // ===== Compute allocation =====
    const alloc = computeAllocation({
      amount,
      paymentType,
      charges: loan.charges,
      accruedInterest,
      totalInterestOwed,
      principalOutstanding: currentPrincipal,
      interestTreatment: loan.interestTreatment ?? null,
    });

    // ===== Overpayment check =====
    // For PART_PAYMENT and INTEREST_ONLY/PRINCIPAL_ONLY, allow partial amounts
    // but reject amounts exceeding what they are applied to.
    const remaining = amount
      .minus(alloc.allocatedCharges)
      .minus(alloc.allocatedInterest)
      .minus(alloc.allocatedPrincipal);

    if (remaining.gt(new Decimal("0.01"))) {
      const typeLabel = paymentType === "PRINCIPAL_ONLY" ? "principal" :
                        paymentType === "INTEREST_ONLY" ? "interest" : "total outstanding";
      throw new Error(
        `Payment of ₹${amount.toString()} exceeds ${typeLabel}. Reduce the payment amount.`
      );
    }

    // ===== Settle charges =====
    for (const detail of alloc.chargeDetails) {
      if (detail.settled) {
        await tx.loanCharge.update({
          where: { id: detail.chargeId },
          data: { isSettled: true },
        });
      }
    }

    // ===== Update loan state =====
    const newPrincipalOutstanding = currentPrincipal.minus(alloc.allocatedPrincipal);

    // Advance the interest clock proportionally to what was paid
    let newLastSettledDate = asOfDate;
    let newInterestOutstanding = currentInterestOutstanding;

    if (paymentType === "INTEREST_ONLY" || paymentType === "PRINCIPAL_ONLY") {
      // For INTEREST_ONLY: advance clock proportionally, update interestOutstanding
      // For PRINCIPAL_ONLY: principal reduced, interest clock unchanged
      if (paymentType === "INTEREST_ONLY") {
        if (totalInterestOwed.gt(0) && alloc.allocatedInterest.gt(0)) {
          const paidFraction = alloc.allocatedInterest.div(totalInterestOwed);
          const daysElapsed = differenceInCalendarDays(asOfDate, currentLastSettledDate);
          if (daysElapsed > 0) {
            const paidDays = paidFraction.times(daysElapsed);
            newLastSettledDate = new Date(
              currentLastSettledDate.getTime() + paidDays.toNumber() * 24 * 60 * 60 * 1000
            );
          }
          // For KEEP_SEPARATE: reduce outstanding interest balance
          if (loan.interestType === "CUMULATIVE" && loan.interestTreatment === "KEEP_SEPARATE") {
            const newOutstanding = totalInterestOwed.minus(alloc.allocatedInterest);
            newInterestOutstanding = newOutstanding.isNegative() ? new Decimal(0) : newOutstanding;
          }
        } else {
          // No interest to pay — keep date unchanged
          newLastSettledDate = currentLastSettledDate;
        }
      } else {
        // PRINCIPAL_ONLY: keep interest clock unchanged
        newLastSettledDate = currentLastSettledDate;
      }
    } else {
      // FULL / PART_PAYMENT / CLOSURE / EARLY_CLOSURE waterfall behavior
      const daysElapsed = differenceInCalendarDays(asOfDate, currentLastSettledDate);
      if (daysElapsed > 0 && accruedInterest.gt(0) && alloc.allocatedInterest.lt(totalInterestOwed)) {
        const paidDays = alloc.allocatedInterest.div(accruedInterest).times(daysElapsed);
        newLastSettledDate = new Date(
          currentLastSettledDate.getTime() + paidDays.toNumber() * 24 * 60 * 60 * 1000
        );
        debugLog(
          "payments",
          `partial interest payment: total=${totalInterestOwed.toString()} paid=${alloc.allocatedInterest.toString()} — advancing ${paidDays.toFixed(2)}/${daysElapsed} days`
        );
      }
      // For KEEP_SEPARATE: update stored interestOutstanding
      if (loan.interestType === "CUMULATIVE" && loan.interestTreatment === "KEEP_SEPARATE") {
        const newOutstanding = totalInterestOwed.minus(alloc.allocatedInterest);
        newInterestOutstanding = newOutstanding.isNegative() ? new Decimal(0) : newOutstanding;
      }
    }

    const loanFullyPaid =
      newPrincipalOutstanding.lte(new Decimal(0)) &&
      alloc.remainingInterest.lte(new Decimal("0.01")) &&
      loan.charges.filter((c) => !c.isSettled).length === alloc.chargeDetails.filter((d) => d.settled).length;

    if ((paymentType === "CLOSURE" || paymentType === "EARLY_CLOSURE") && !loanFullyPaid) {
      throw new Error("Cannot close loan: payment does not fully settle all outstanding dues.");
    }

    const shouldClose = loanFullyPaid && (
      paymentType === "CLOSURE" ||
      paymentType === "EARLY_CLOSURE" ||
      paymentType === "FULL"
    );

    await tx.loan.update({
      where: { id: loanId },
      data: {
        principalOutstanding: newPrincipalOutstanding.isNegative()
          ? new Decimal(0)
          : newPrincipalOutstanding,
        lastSettledDate: newLastSettledDate,
        interestOutstanding: newInterestOutstanding.isNegative()
          ? new Decimal(0)
          : newInterestOutstanding,
        lastCapitalizedAt: currentLastCapitalizedAt,
        ...(shouldClose
          ? {
              status: "CLOSED",
              closedAt: asOfDate,
              closedById: collectedById,
            }
          : {}),
      },
    });

    // ===== Create Payment record =====
    const receiptNumber = await generateReceiptNumber(tx);

    const payment = await tx.payment.create({
      data: {
        loanId,
        receiptNumber,
        paymentDate: asOfDate,
        amountPaid: amount,
        mode,
        paymentType,
        allocatedCharges: alloc.allocatedCharges,
        allocatedInterest: alloc.allocatedInterest,
        allocatedPrincipal: alloc.allocatedPrincipal,
        collectedById,
        notes,
      },
    });

    // ===== Create LedgerEntry =====
    const counterCashAccountId = await resolveCounterCashAccount(tx);
    await writeLedgerEntry(tx, {
      loanId,
      type: "PAYMENT",
      amount,
      principalAfter: newPrincipalOutstanding.isNegative()
        ? new Decimal(0)
        : newPrincipalOutstanding,
      referenceId: payment.id,
      accountId: counterCashAccountId,
      description: `Payment [${paymentType}] ₹${amount.toString()} — Charges: ₹${alloc.allocatedCharges.toString()}, Interest: ₹${alloc.allocatedInterest.toString()}, Principal: ₹${alloc.allocatedPrincipal.toString()}`,
    });

    if (shouldClose) {
      await writeLedgerEntry(tx, {
        loanId,
        type: "CLOSURE",
        amount: new Decimal(0),
        principalAfter: new Decimal(0),
        accountId: null,
        description: `Loan ${loan.loanNumber} closed — all dues settled (${paymentType})`,
      });
    }

    return {
      paymentId: payment.id,
      receiptNumber,
      allocation: {
        allocatedCharges: alloc.allocatedCharges,
        allocatedInterest: alloc.allocatedInterest,
        allocatedPrincipal: alloc.allocatedPrincipal,
        remainingPrincipal: newPrincipalOutstanding.isNegative()
          ? new Decimal(0)
          : newPrincipalOutstanding,
        remainingInterest: alloc.remainingInterest,
        chargeDetails: alloc.chargeDetails,
      },
      loanFullyPaid,
    };
  });
}
