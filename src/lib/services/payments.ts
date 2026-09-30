/**
 * Payment Service — §6.4
 *
 * Implements the payment allocation waterfall within an atomic DB transaction.
 * Every payment write is one atomic prisma.$transaction — a partially-applied
 * payment is a data-integrity incident, not a bug (Non-Negotiable #2).
 *
 * Waterfall order:
 *   1. Outstanding charges (oldest first)
 *   2. Accrued interest
 *   3. Principal
 *
 * Overpayment beyond total outstanding is rejected, not silently dropped.
 */

import { Prisma, PaymentMode } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { prisma, runSerializable } from "@/lib/db";
import { debugLog } from "@/lib/debug";
import { computeAccruedInterest } from "./interest";
import { writeLedgerEntry } from "@/lib/ledger-writer";
import { resolveCounterCashAccount } from "@/lib/services/account-resolver";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface PaymentAllocation {
  allocatedCharges: Decimal;
  allocatedInterest: Decimal;
  allocatedPrincipal: Decimal;
  remainingPrincipal: Decimal;
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
  asOfDate: Date = new Date()
): Promise<PaymentAllocation & { accruedInterest: Decimal; totalDue: Decimal }> {
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
  let remaining = amount;

  // 1. Charges
  let allocatedCharges = new Decimal(0);
  const chargeDetails: PaymentAllocation["chargeDetails"] = [];
  for (const charge of loan.charges) {
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

  // 2. Interest
  const accruedInterest = computeAccruedInterest(
    {
      principalOutstanding: loan.principalOutstanding,
      interestRateMonthly: loan.interestRateMonthly,
      lastSettledDate: loan.lastSettledDate,
    },
    asOfDate
  );
  const allocatedInterest = Decimal.min(remaining, accruedInterest);
  remaining = remaining.minus(allocatedInterest);

  // 3. Principal
  const allocatedPrincipal = Decimal.min(remaining, loan.principalOutstanding);
  remaining = remaining.minus(allocatedPrincipal);

  const remainingPrincipal = loan.principalOutstanding.minus(allocatedPrincipal);

  const totalCharges = loan.charges.reduce((sum, c) => sum.plus(c.amount), new Decimal(0));
  const totalDue = totalCharges.plus(accruedInterest).plus(loan.principalOutstanding);

  return {
    allocatedCharges,
    allocatedInterest,
    allocatedPrincipal,
    remainingPrincipal,
    chargeDetails,
    accruedInterest,
    totalDue,
  };
}

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
  asOfDate: Date = new Date()
): Promise<PaymentResult> {
  const amount = new Decimal(amountPaid);

  if (amount.lte(new Decimal(0))) {
    throw new Error("Payment amount must be positive");
  }

  debugLog("payments", `recordPayment: loan=${loanId} amount=${amount.toString()} mode=${mode}`);

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

    let remaining = amount;

    // ===== 1. Outstanding charges (oldest first) =====
    let allocatedCharges = new Decimal(0);
    const chargeDetails: PaymentAllocation["chargeDetails"] = [];

    for (const charge of loan.charges) {
      if (remaining.lte(new Decimal(0))) break;

      const pay = Decimal.min(remaining, charge.amount);
      allocatedCharges = allocatedCharges.plus(pay);
      remaining = remaining.minus(pay);

      const settled = pay.gte(charge.amount);
      chargeDetails.push({ chargeId: charge.id, amount: pay, settled });

      if (settled) {
        await tx.loanCharge.update({
          where: { id: charge.id },
          data: { isSettled: true },
        });
      }
    }

    // ===== 2. Accrued interest =====
    const accruedInterest = computeAccruedInterest(
      {
        principalOutstanding: loan.principalOutstanding,
        interestRateMonthly: loan.interestRateMonthly,
        lastSettledDate: loan.lastSettledDate,
      },
      asOfDate
    );
    const allocatedInterest = Decimal.min(remaining, accruedInterest);
    remaining = remaining.minus(allocatedInterest);

    // ===== 3. Principal =====
    const allocatedPrincipal = Decimal.min(remaining, loan.principalOutstanding);
    remaining = remaining.minus(allocatedPrincipal);

    // ===== Reject overpayment =====
    if (remaining.gt(new Decimal("0.01"))) {
      throw new Error(
        `Payment of ₹${amount.toString()} exceeds total outstanding of ₹${amount
          .minus(remaining)
          .toString()}. Reduce the payment amount.`
      );
    }

    // ===== Update loan state =====
    const newPrincipalOutstanding = loan.principalOutstanding.minus(allocatedPrincipal);

    // Only advance the interest clock by the fraction of accrued interest that was
    // actually paid — advancing it fully regardless would silently forgive any
    // interest left unpaid because charges/allocatedInterest capped the payment.
    const daysElapsed = differenceInCalendarDays(asOfDate, loan.lastSettledDate);
    let newLastSettledDate = asOfDate;
    if (daysElapsed > 0 && accruedInterest.gt(0) && allocatedInterest.lt(accruedInterest)) {
      const paidDays = allocatedInterest.div(accruedInterest).times(daysElapsed);
      newLastSettledDate = new Date(
        loan.lastSettledDate.getTime() + paidDays.toNumber() * 24 * 60 * 60 * 1000
      );
      debugLog(
        "payments",
        `partial interest payment: accrued=${accruedInterest.toString()} paid=${allocatedInterest.toString()} — advancing clock ${paidDays.toFixed(2)}/${daysElapsed} days instead of full settle`
      );
    }

    await tx.loan.update({
      where: { id: loanId },
      data: {
        principalOutstanding: newPrincipalOutstanding,
        lastSettledDate: newLastSettledDate,
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
        allocatedCharges,
        allocatedInterest,
        allocatedPrincipal,
        collectedById,
        notes,
      },
    });

    // ===== Create LedgerEntry (account-aware Counter Cash posting) =====
    const counterCashAccountId = await resolveCounterCashAccount(tx);
    await writeLedgerEntry(tx, {
      loanId,
      type: "PAYMENT",
      amount,
      principalAfter: newPrincipalOutstanding,
      referenceId: payment.id,
      accountId: counterCashAccountId,
      description: `Payment of ₹${amount.toString()} — Charges: ₹${allocatedCharges.toString()}, Interest: ₹${allocatedInterest.toString()}, Principal: ₹${allocatedPrincipal.toString()}`,
    });

    return {
      paymentId: payment.id,
      receiptNumber,
      allocation: {
        allocatedCharges,
        allocatedInterest,
        allocatedPrincipal,
        remainingPrincipal: newPrincipalOutstanding,
        chargeDetails,
      },
      loanFullyPaid: newPrincipalOutstanding.eq(new Decimal(0)),
    };
  });
}
