/**
 * Dashboard Service — KPI aggregations and quick-access queries.
 * "Overdue" is derived at query time, never stored.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { debugLog } from "@/lib/debug";
import { deriveLoanDisplayStatus } from "./loans";

const Decimal = Prisma.Decimal;

export interface DashboardFilter {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export async function getDashboardStats(filter?: DashboardFilter) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  // Period Date Range Normalization (if provided, else default to all time or today)
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  if (filter?.startDate) {
    const s = new Date(filter.startDate);
    if (!isNaN(s.getTime())) {
      periodStart = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
    }
  }
  if (filter?.endDate) {
    const e = new Date(filter.endDate);
    if (!isNaN(e.getTime())) {
      periodEnd = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999);
    }
  }

  // Authoritative query for all active loans (point-in-time)
  const activeLoans = await prisma.loan.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      loanNumber: true,
      principalOutstanding: true,
      principalAmount: true,
      dueDate: true,
      gracePeriodDays: true,
      status: true,
      ltvPercent: true,
      interestRateMonthly: true,
      lastSettledDate: true,
    },
  });

  let activeCount = 0;
  let overdueCount = 0;
  let totalAUM = new Decimal(0);
  let overdueAmount = new Decimal(0);
  let dueIn7Days = 0;
  let dueIn30Days = 0;
  let totalLtv = new Decimal(0);
  let weeklyInterestAccrued = new Decimal(0);
  let totalAccruedInterest = new Decimal(0);

  const { computeAccruedInterest } = await import("./interest");

  for (const loan of activeLoans) {
    const displayStatus = deriveLoanDisplayStatus(loan);
    totalAUM = totalAUM.plus(loan.principalOutstanding);
    if (loan.ltvPercent) {
      totalLtv = totalLtv.plus(loan.ltvPercent);
    }
    if (loan.interestRateMonthly) {
      const monthlyInterest = loan.principalOutstanding.mul(loan.interestRateMonthly).div(100);
      weeklyInterestAccrued = weeklyInterestAccrued.plus(monthlyInterest.div(4.33));
    }

    // Authoritative Actual/365 interest engine calculation
    const accrued = computeAccruedInterest(
      {
        principalOutstanding: loan.principalOutstanding,
        interestRateMonthly: loan.interestRateMonthly,
        lastSettledDate: loan.lastSettledDate,
      },
      now
    );
    totalAccruedInterest = totalAccruedInterest.plus(accrued);

    if (displayStatus === "OVERDUE") {
      overdueCount++;
      overdueAmount = overdueAmount.plus(loan.principalOutstanding);
    } else {
      activeCount++;
    }

    if (loan.dueDate >= today && loan.dueDate <= in7Days) {
      dueIn7Days++;
    }
    if (loan.dueDate >= today && loan.dueDate <= in30Days) {
      dueIn30Days++;
    }
  }

  // Lifetime counts & aggregates
  const [totalLoansCount, closedCount, customerCount, totalDisbursedLifetime] = await Promise.all([
    prisma.loan.count(),
    prisma.loan.count({ where: { status: "CLOSED" } }),
    prisma.customer.count(),
    prisma.loan.aggregate({
      _sum: { principalAmount: true },
    }),
  ]);

  // Point-in-time closed loan principal sum
  const closedLoansAgg = await prisma.loan.aggregate({
    where: { status: "CLOSED" },
    _sum: { principalAmount: true },
  });

  // Disbursement metrics: Today, Week, and Period
  const disbursementWhere: Prisma.LoanWhereInput = {};
  if (periodStart && periodEnd) {
    disbursementWhere.loanDate = { gte: periodStart, lte: periodEnd };
  } else if (periodStart) {
    disbursementWhere.loanDate = { gte: periodStart };
  } else if (periodEnd) {
    disbursementWhere.loanDate = { lte: periodEnd };
  }

  const [disbursedToday, disbursedWeek, disbursedPeriod] = await Promise.all([
    prisma.loan.aggregate({
      where: { loanDate: { gte: today, lte: todayEnd } },
      _sum: { principalAmount: true },
      _count: true,
    }),
    prisma.loan.aggregate({
      where: { loanDate: { gte: weekAgo } },
      _sum: { principalAmount: true },
      _count: true,
    }),
    prisma.loan.aggregate({
      where: Object.keys(disbursementWhere).length > 0 ? disbursementWhere : undefined,
      _sum: { principalAmount: true },
      _count: true,
    }),
  ]);

  // Payment metrics: Today and Period
  const paymentWhere: Prisma.PaymentWhereInput = {};
  if (periodStart && periodEnd) {
    paymentWhere.paymentDate = { gte: periodStart, lte: periodEnd };
  } else if (periodStart) {
    paymentWhere.paymentDate = { gte: periodStart };
  } else if (periodEnd) {
    paymentWhere.paymentDate = { lte: periodEnd };
  }

  const [collectionsToday, collectionsPeriod] = await Promise.all([
    prisma.payment.aggregate({
      where: { paymentDate: { gte: today, lte: todayEnd } },
      _sum: {
        amountPaid: true,
        allocatedPrincipal: true,
        allocatedInterest: true,
        allocatedCharges: true,
      },
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

  // Recent loans
  const recentLoans = await prisma.loan.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { fullName: true, phone: true } },
    },
  });

  // Overdue loans
  const overdueLoans = activeLoans
    .filter((l) => deriveLoanDisplayStatus(l) === "OVERDUE")
    .slice(0, 10);

  const overdueLoansDetailed =
    overdueLoans.length > 0
      ? await prisma.loan.findMany({
          where: { id: { in: overdueLoans.map((l) => l.id) } },
          include: {
            customer: { select: { fullName: true, phone: true } },
          },
          orderBy: { dueDate: "asc" },
        })
      : [];

  const pendingFollowUpsCount = await prisma.followUp.count({
    where: {
      status: "PENDING",
      dueDate: { gte: today, lte: in7Days },
    },
  });

  const avgLtv = activeCount > 0 ? totalLtv.div(activeCount).toFixed(1) : "0";

  // Recent activity from single-entry LedgerEntry table
  const { classifyFlow } = await import("./day-book");
  const recentLedgerWhere: Prisma.LedgerEntryWhereInput = {};
  if (periodStart && periodEnd) {
    recentLedgerWhere.createdAt = { gte: periodStart, lte: periodEnd };
  } else if (periodStart) {
    recentLedgerWhere.createdAt = { gte: periodStart };
  } else if (periodEnd) {
    recentLedgerWhere.createdAt = { lte: periodEnd };
  }

  const recentLedgerEntries = await prisma.ledgerEntry.findMany({
    where: Object.keys(recentLedgerWhere).length > 0 ? recentLedgerWhere : undefined,
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      loan: {
        select: {
          loanNumber: true,
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      },
      account: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
  });

  const recentActivity = recentLedgerEntries.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    type: e.type,
    flow: classifyFlow(e.type),
    amount: e.amount,
    principalAfter: e.principalAfter,
    loanNumber: e.loan.loanNumber,
    customerName: e.loan.customer.fullName,
    customerPhone: e.loan.customer.phone,
    accountId: e.accountId,
    accountCode: e.account?.code ?? null,
    accountName: e.account?.name ?? null,
    referenceId: e.referenceId,
    description: e.description,
  }));

  // Operational section summaries
  const totalPrincipalOutstanding = totalAUM;
  const totalExposure = totalPrincipalOutstanding.plus(totalAccruedInterest);

  const loanStatusSummary = {
    active: { count: activeCount, amount: totalAUM.minus(overdueAmount) },
    overdue: { count: overdueCount, amount: overdueAmount },
    closed: { count: closedCount, amount: closedLoansAgg._sum.principalAmount ?? new Decimal(0) },
    ACTIVE: { count: activeCount, amount: totalAUM.minus(overdueAmount) },
    OVERDUE: { count: overdueCount, amount: overdueAmount },
    CLOSED: { count: closedCount, amount: closedLoansAgg._sum.principalAmount ?? new Decimal(0) },
  };

  const collectionsSummary = {
    count: collectionsPeriod._count,
    totalCollected: collectionsPeriod._sum.amountPaid ?? new Decimal(0),
    principalCollected: collectionsPeriod._sum.allocatedPrincipal ?? new Decimal(0),
    interestCollected: collectionsPeriod._sum.allocatedInterest ?? new Decimal(0),
    chargesCollected: collectionsPeriod._sum.allocatedCharges ?? new Decimal(0),
    startDate: periodStart ? periodStart.toISOString() : null,
    endDate: periodEnd ? periodEnd.toISOString() : null,
  };

  const disbursementSummary = {
    count: disbursedPeriod._count,
    totalDisbursed: disbursedPeriod._sum.principalAmount ?? new Decimal(0),
    startDate: periodStart ? periodStart.toISOString() : null,
    endDate: periodEnd ? periodEnd.toISOString() : null,
  };

  const portfolioSummary = {
    totalLoanCount: totalLoansCount,
    activeLoanCount: activeCount,
    overdueLoanCount: overdueCount,
    closedLoanCount: closedCount,
    totalPrincipalDisbursed: totalDisbursedLifetime._sum.principalAmount ?? new Decimal(0),
    totalPrincipalOutstanding,
    totalAccruedInterest,
    totalExposure,
  };

  debugLog(
    "dashboard",
    `getDashboardStats: active=${activeCount} overdue=${overdueCount} closed=${closedCount} AUM=${totalAUM.toString()} accruedInterest=${totalAccruedInterest.toString()}`
  );

  return {
    // Core KPIs
    totalLoansCount,
    activeCount,
    overdueCount,
    closedCount,
    totalAUM: totalAUM.toString(),
    totalPrincipalOutstanding,
    totalAccruedInterest,
    totalExposure,
    overdueAmount: overdueAmount.toString(),
    dueIn7Days,
    dueIn30Days,
    avgLtv,
    weeklyInterestAccrued: weeklyInterestAccrued.toFixed(0),
    pendingFollowUpsCount,
    disbursedToday: {
      count: disbursedToday._count,
      amount: disbursedToday._sum.principalAmount?.toString() ?? "0",
    },
    disbursedWeek: {
      count: disbursedWeek._count,
      amount: disbursedWeek._sum.principalAmount?.toString() ?? "0",
    },
    disbursedPeriod: {
      count: disbursedPeriod._count,
      amount: disbursedPeriod._sum.principalAmount ?? new Decimal(0),
    },
    collectionsToday: {
      count: collectionsToday._count,
      amount: collectionsToday._sum.amountPaid?.toString() ?? "0",
    },
    collectionsPeriod: {
      count: collectionsPeriod._count,
      totalCollected: collectionsPeriod._sum.amountPaid ?? new Decimal(0),
      principalCollected: collectionsPeriod._sum.allocatedPrincipal ?? new Decimal(0),
      interestCollected: collectionsPeriod._sum.allocatedInterest ?? new Decimal(0),
      chargesCollected: collectionsPeriod._sum.allocatedCharges ?? new Decimal(0),
    },
    recentLoans: recentLoans.map((l) => ({
      ...l,
      displayStatus: deriveLoanDisplayStatus(l),
    })),
    overdueLoans: overdueLoansDetailed.map((l) => ({
      ...l,
      displayStatus: "OVERDUE" as const,
    })),
    customerCount,
    // Filter context
    filterPeriod: {
      isFiltered: !!(periodStart || periodEnd),
      startDate: periodStart ? periodStart.toISOString() : null,
      endDate: periodEnd ? periodEnd.toISOString() : null,
    },
    // Aliases for comprehensive metric access
    activeLoansCount: activeCount,
    overdueLoansCount: overdueCount,
    closedLoansCount: closedCount,
    totalActivePrincipal: loanStatusSummary.ACTIVE.amount,
    totalOverduePrincipal: loanStatusSummary.OVERDUE.amount,
    totalClosedPrincipal: loanStatusSummary.CLOSED.amount,
    totalPaymentsCollected: collectionsPeriod._sum.amountPaid ?? new Decimal(0),
    totalPaymentsCount: collectionsPeriod._count,
    totalDisbursedAmount: disbursedPeriod._sum.principalAmount ?? new Decimal(0),
    totalDisbursementsCount: disbursedPeriod._count,
    // Operational sections
    loanStatusSummary,
    collectionsSummary,
    disbursementSummary,
    portfolioSummary,
    recentActivity,
  };
}

export async function getDashboardChartData() {
  const allLoans = await prisma.loan.findMany({
    include: {
      items: { select: { metalType: true, assessedValue: true } },
    },
  });
  const allPayments = await prisma.payment.findMany();

  // 1. Metal Breakdown
  let goldCount = 0;
  let silverCount = 0;
  let goldValue = new Decimal(0);
  let silverValue = new Decimal(0);

  for (const loan of allLoans) {
    for (const item of loan.items) {
      if (item.metalType === "GOLD") {
        goldCount++;
        goldValue = goldValue.plus(item.assessedValue);
      } else {
        silverCount++;
        silverValue = silverValue.plus(item.assessedValue);
      }
    }
  }

  // 2. Status Breakdown
  let activeVal = new Decimal(0);
  let overdueVal = new Decimal(0);
  let closedVal = new Decimal(0);
  let activeCnt = 0;
  let overdueCnt = 0;
  let closedCnt = 0;

  for (const loan of allLoans) {
    const st = deriveLoanDisplayStatus(loan);
    if (st === "OVERDUE") {
      overdueCnt++;
      overdueVal = overdueVal.plus(loan.principalOutstanding);
    } else if (st === "CLOSED" || loan.status === "CLOSED") {
      closedCnt++;
      closedVal = closedVal.plus(loan.principalAmount);
    } else {
      activeCnt++;
      activeVal = activeVal.plus(loan.principalOutstanding);
    }
  }

  // 3. Monthly Disbursed vs Collected (Last 6 Months)
  const monthlyData: Record<string, { month: string; disbursed: number; collected: number }> = {};
  const now = new Date();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
    monthlyData[key] = { month: key, disbursed: 0, collected: 0 };
  }

  for (const loan of allLoans) {
    const d = new Date(loan.loanDate);
    const key = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
    if (monthlyData[key]) {
      monthlyData[key].disbursed += Number(loan.principalAmount);
    }
  }

  for (const pay of allPayments) {
    const d = new Date(pay.paymentDate);
    const key = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
    if (monthlyData[key]) {
      monthlyData[key].collected += Number(pay.amountPaid);
    }
  }

  return {
    metalBreakdown: [
      { name: "Gold Loans", count: goldCount, value: Number(goldValue), fill: "#16a34a" },
      { name: "Silver Loans", count: silverCount, value: Number(silverValue), fill: "#86efac" },
    ],
    statusBreakdown: [
      { name: "Active", count: activeCnt, value: Number(activeVal), fill: "#22c55e" },
      { name: "Overdue", count: overdueCnt, value: Number(overdueVal), fill: "#f43f5e" },
      { name: "Closed", count: closedCnt, value: Number(closedVal), fill: "#94a3b8" },
    ],
    monthlyTrend: Object.values(monthlyData),
  };
}
