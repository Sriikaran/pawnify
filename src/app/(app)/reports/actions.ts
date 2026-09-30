"use server";

import { checkAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { serializeForClient } from "@/lib/serialize";
import {
  projectReportsData,
  projectLoanRegisterReport,
  projectPaymentRegisterReport,
  projectDisbursementRegisterReport,
  projectOverdueLoansReport,
  projectCustomerWiseSummaryReport,
  projectAccountWiseSummaryReport,
  projectDayBookSummaryReport,
  projectPortfolioSummaryReport,
  projectTransactionHistoryReport,
} from "@/lib/projection";
import {
  getLoanRegisterReport,
  LoanRegisterFilter,
  getPaymentRegisterReport,
  PaymentRegisterFilter,
  getDisbursementRegisterReport,
  DisbursementRegisterFilter,
  getOverdueLoansReport,
  OverdueLoansFilter,
  getCustomerWiseLoanSummaryReport,
  CustomerWiseSummaryFilter,
  getAccountWiseFinancialSummaryReport,
  AccountWiseSummaryFilter,
  getDayBookSummaryReport,
  DayBookSummaryFilter,
  getPortfolioSummaryReport,
  PortfolioSummaryFilter,
  getTransactionHistoryReport,
  TransactionHistoryFilter,
} from "@/lib/services/reports";
import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

/**
 * Legacy summary report action preserved for backwards compatibility.
 */
export async function getReportsDataAction() {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const allLoans = await prisma.loan.findMany({
    include: { items: { select: { metalType: true, assessedValue: true } } },
  });

  const allPayments = await prisma.payment.findMany();
  const allCharges = await prisma.loanCharge.findMany();

  let activeCount = 0;
  let overdueCount = 0;
  let closedCount = 0;
  let totalActiveAUM = new Decimal(0);

  let goldLoansCount = 0;
  let silverLoansCount = 0;
  let goldAssessedValue = new Decimal(0);
  let silverAssessedValue = new Decimal(0);

  let ltv85Count = 0;
  let ltv80Count = 0;
  let ltv75Count = 0;

  const today = new Date();

  for (const loan of allLoans) {
    const ltv = parseFloat(loan.ltvPercent.toString());

    if (loan.status === "CLOSED") {
      closedCount++;
    } else {
      totalActiveAUM = totalActiveAUM.plus(loan.principalOutstanding);
      const graceDueDate = new Date(loan.dueDate);
      graceDueDate.setDate(graceDueDate.getDate() + loan.gracePeriodDays);
      if (today > graceDueDate) overdueCount++;
      else activeCount++;
    }

    if (ltv >= 85) ltv85Count++;
    else if (ltv >= 80) ltv80Count++;
    else ltv75Count++;

    const isGold = loan.items.some((i) => i.metalType === "GOLD");
    const isSilver = loan.items.some((i) => i.metalType === "SILVER");

    if (isGold) {
      goldLoansCount++;
      goldAssessedValue = goldAssessedValue.plus(loan.totalAssessedValue);
    }
    if (isSilver && !isGold) {
      silverLoansCount++;
      silverAssessedValue = silverAssessedValue.plus(loan.totalAssessedValue);
    }
  }

  let totalCollected = new Decimal(0);
  let interestCollected = new Decimal(0);
  let principalCollected = new Decimal(0);
  let chargesCollected = new Decimal(0);

  for (const p of allPayments) {
    totalCollected = totalCollected.plus(p.amountPaid);
    interestCollected = interestCollected.plus(p.allocatedInterest);
    principalCollected = principalCollected.plus(p.allocatedPrincipal);
    chargesCollected = chargesCollected.plus(p.allocatedCharges);
  }

  let totalDisbursed = new Decimal(0);
  for (const l of allLoans) {
    totalDisbursed = totalDisbursed.plus(l.principalAmount);
  }

  const rawReports = {
    totalLoansCount: allLoans.length,
    totalPaymentsCount: allPayments.length,
    totalChargesCount: allCharges.length,
    activeCount,
    overdueCount,
    closedCount,
    totalActiveAUM: totalActiveAUM.toNumber(),
    goldLoansCount,
    silverLoansCount,
    goldAssessedValue: goldAssessedValue.toNumber(),
    silverAssessedValue: silverAssessedValue.toNumber(),
    ltv85Count,
    ltv80Count,
    ltv75Count,
    totalCollected: totalCollected.toNumber(),
    interestCollected: interestCollected.toNumber(),
    principalCollected: principalCollected.toNumber(),
    chargesCollected: chargesCollected.toNumber(),
    totalDisbursed: totalDisbursed.toNumber(),
  };

  const projectedReports = projectReportsData(rawReports, auth.calculationMode);

  return serializeForClient(projectedReports);
}

// ==================== PHASE 10 REPORT SERVER ACTIONS ====================

/**
 * 1. Loan Register Report
 */
export async function getLoanRegisterReportAction(filter?: LoanRegisterFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const report = await getLoanRegisterReport(filter);
  const projected = projectLoanRegisterReport(report, auth.calculationMode);
  return serializeForClient(projected);
}

/**
 * 2. Payment / Collection Register Report
 */
export async function getPaymentRegisterReportAction(filter?: PaymentRegisterFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const report = await getPaymentRegisterReport(filter);
  const projected = projectPaymentRegisterReport(report, auth.calculationMode);
  return serializeForClient(projected);
}

/**
 * 3. Disbursement Register Report
 */
export async function getDisbursementRegisterReportAction(filter?: DisbursementRegisterFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const report = await getDisbursementRegisterReport(filter);
  const projected = projectDisbursementRegisterReport(report, auth.calculationMode);
  return serializeForClient(projected);
}

/**
 * 4. Overdue Loans Report
 */
export async function getOverdueLoansReportAction(filter?: OverdueLoansFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const report = await getOverdueLoansReport(filter);
  const projected = projectOverdueLoansReport(report, auth.calculationMode);
  return serializeForClient(projected);
}

/**
 * 5. Customer-wise Loan Summary Report
 */
export async function getCustomerWiseLoanSummaryReportAction(filter?: CustomerWiseSummaryFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const report = await getCustomerWiseLoanSummaryReport(filter);
  const projected = projectCustomerWiseSummaryReport(report, auth.calculationMode);
  return serializeForClient(projected);
}

/**
 * 6. Account-wise Financial Summary Report
 */
export async function getAccountWiseFinancialSummaryReportAction(filter?: AccountWiseSummaryFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const report = await getAccountWiseFinancialSummaryReport(filter);
  const projected = projectAccountWiseSummaryReport(report, auth.calculationMode);
  return serializeForClient(projected);
}

/**
 * 7. Day Book Summary Report
 */
export async function getDayBookSummaryReportAction(filter?: DayBookSummaryFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const report = await getDayBookSummaryReport(filter);
  const projected = projectDayBookSummaryReport(report, auth.calculationMode);
  return serializeForClient(projected);
}

/**
 * 8. Portfolio Summary Report
 */
export async function getPortfolioSummaryReportAction(filter?: PortfolioSummaryFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const report = await getPortfolioSummaryReport(filter);
  const projected = projectPortfolioSummaryReport(report, auth.calculationMode);
  return serializeForClient(projected);
}

/**
 * 9. Transaction History Report
 */
export async function getTransactionHistoryReportAction(filter?: TransactionHistoryFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const report = await getTransactionHistoryReport(filter);
  const projected = projectTransactionHistoryReport(report, auth.calculationMode);
  return serializeForClient(projected);
}
