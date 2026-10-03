"use server";

import { revalidatePath } from "next/cache";
import { checkAuth, checkAdmin } from "@/lib/auth/session";
import { recordPayment } from "@/lib/services/payments";
import { closeLoan, releaseItems, getLoanById } from "@/lib/services/loans";
import { paymentSchema } from "@/lib/validation/payment";
import { serializeForClient } from "@/lib/serialize";
import { projectLoan, invertMonetaryInputNumber, projectMonetaryDecimal } from "@/lib/projection";
import { Prisma } from "@prisma/client";
import { writeLedgerEntry } from "@/lib/ledger-writer";
import { resolveCounterCashAccount } from "@/lib/services/account-resolver";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export async function getLoanDetailAction(loanId: string) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }
  const loan = await getLoanById(loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }
  const projectedLoan = projectLoan(loan, auth.calculationMode);
  return serializeForClient(projectedLoan);
}

export async function recordPaymentAction(formData: unknown) {
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.user) {
    return { success: false, error: "Unauthorized. Please sign in." };
  }

  const parsed = paymentSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid payment data",
    };
  }

  try {
    // Critical Input Rule (PART I):
    // In FIFTY_PERCENT mode, the user entered amount in displayed monetary system (halved).
    // Convert back to true 100% legal amount before calling pure domain service recordPayment.
    const trueAmountPaid = invertMonetaryInputNumber(
      parsed.data.amountPaid,
      auth.calculationMode
    );

    const pmt = await recordPayment(
      parsed.data.loanId,
      trueAmountPaid,
      parsed.data.mode,
      auth.user.id,
      parsed.data.notes,
      new Date(),
      parsed.data.paymentType
    );

    revalidatePath(`/loans/${parsed.data.loanId}`);
    revalidatePath("/loans");
    revalidatePath("/dashboard");
    return { success: true, receiptNumber: pmt.receiptNumber };
  } catch (err: unknown) {
    console.error("Payment recording error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record payment",
    };
  }
}

export async function getEarlyClosureSummaryAction(loanId: string) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }
  const loan = await getLoanById(loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }

  const chargesSum = loan.charges
    .filter((c) => !c.isSettled)
    .reduce((sum, c) => sum.plus(c.amount), new Decimal(0));
  const totalInterest = loan.interestSummary.totalInterestOwed;
  const settlementTotal = loan.principalOutstanding
    .plus(totalInterest)
    .plus(chargesSum);

  const rawSummary = {
    principalOutstanding: loan.principalOutstanding,
    accruedInterest: totalInterest,
    unsettledCharges: chargesSum,
    settlementTotal,
  };

  if (auth.calculationMode === "FIFTY_PERCENT") {
    return serializeForClient({
      principalOutstanding: projectMonetaryDecimal(rawSummary.principalOutstanding, auth.calculationMode),
      accruedInterest: projectMonetaryDecimal(rawSummary.accruedInterest, auth.calculationMode),
      unsettledCharges: projectMonetaryDecimal(rawSummary.unsettledCharges, auth.calculationMode),
      settlementTotal: projectMonetaryDecimal(rawSummary.settlementTotal, auth.calculationMode),
    });
  }

  return serializeForClient(rawSummary);
}

export async function cancelDisbursedLoanAction(loanId: string, reason: string) {
  const auth = await checkAdmin();
  if (!auth.authenticated) {
    return { success: false, error: auth.error };
  }

  try {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { items: true },
    });

    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.status === "CLOSED" && loan.cancelledAt) {
      return { success: false, error: "Loan is already cancelled" };
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Update loan status to CLOSED and record cancellation audit metadata
      await tx.loan.update({
        where: { id: loanId },
        data: {
          status: "CLOSED",
          closedAt: now,
          closedById: auth.user!.id,
          cancelledAt: now,
          cancelledById: auth.user!.id,
          cancellationReason: reason.trim(),
          principalOutstanding: new Decimal(0),
        },
      });

      // 2. Release collateral items safely
      await tx.loanItem.updateMany({
        where: { loanId, releasedAt: null },
        data: { releasedAt: now },
      });

      // 3. Write single-entry CANCELLATION audit record
      const counterCashAccountId = await resolveCounterCashAccount(tx);
      await writeLedgerEntry(tx, {
        loanId,
        type: "CANCELLATION",
        amount: loan.principalAmount,
        principalAfter: new Decimal(0),
        accountId: counterCashAccountId,
        description: `Loan ${loan.loanNumber} cancelled/reversed: ${reason.trim()}`,
      });
    });

    revalidatePath(`/loans/${loanId}`);
    revalidatePath("/loans");
    revalidatePath("/dashboard");
    revalidatePath("/day-book");
    revalidatePath("/account-ledger");
    return { success: true };
  } catch (err: unknown) {
    console.error("Cancel loan error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to cancel loan",
    };
  }
}

export async function closeLoanAction(loanId: string) {
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await closeLoan(loanId, auth.user.id);
    revalidatePath(`/loans/${loanId}`);
    revalidatePath("/loans");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    console.error("Close loan error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to close loan",
    };
  }
}

export async function releaseItemsAction(loanId: string) {
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await releaseItems(loanId);
    revalidatePath(`/loans/${loanId}`);
    revalidatePath("/loans");
    return { success: true };
  } catch (err: unknown) {
    console.error("Release items error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to release items",
    };
  }
}

import { prisma } from "@/lib/db";

export async function updateLoanNotesAction(loanId: string, notes: string) {
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.loan.update({
      where: { id: loanId },
      data: { notes: notes.trim() || null },
    });
    revalidatePath(`/loans/${loanId}`);
    return { success: true };
  } catch (err: unknown) {
    console.error("Update loan notes error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update loan notes",
    };
  }
}

export async function deleteLoanAction(loanId: string) {
  const auth = await checkAdmin();
  if (!auth.authenticated) {
    return { success: false, error: auth.error };
  }

  try {
    const hasLedger = await prisma.ledgerEntry.count({ where: { loanId } });
    const hasPayments = await prisma.payment.count({ where: { loanId } });
    if (hasLedger > 0 || hasPayments > 0) {
      return {
        success: false,
        error: "Cannot delete loan with financial ledger entries or payment records. Financial audit records must remain immutable.",
      };
    }

    await prisma.loanItem.deleteMany({ where: { loanId } });
    await prisma.loanCharge.deleteMany({ where: { loanId } });
    await prisma.followUp.deleteMany({ where: { loanId } });
    await prisma.loan.delete({ where: { id: loanId } });

    revalidatePath("/loans");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    console.error("Delete loan error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete loan",
    };
  }
}
