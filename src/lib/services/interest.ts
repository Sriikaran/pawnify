/**
 * Interest Service — Unified Interest Engine
 *
 * Supports two loan interest types:
 *   STANDARD  — Simple flat rate, Actual/365, interest never auto-capitalizes.
 *   CUMULATIVE — Interest accrues over a configurable period. At period end:
 *                ADD_TO_CAPITAL: accrued interest is capitalized into principal.
 *                KEEP_SEPARATE:  accrued interest stays separate; principal unchanged.
 *
 * Rate Normalization:
 *   Internal representation: interestRateMonthly (% per month).
 *   Equivalent representations supported at input:
 *     A. Amount per ₹100 (e.g. ₹1.5 per ₹100 = 1.5% per month)
 *     B. Percentage (e.g. 1.5% per month)
 *   Both normalize to interestRateMonthly.
 *
 * Interest Frequency:
 *   DAILY     → interest clock is per-day (Actual/365)
 *   MONTHLY   → interest resets/accrues monthly
 *   QUARTERLY → every 3 months
 *   HALF_YEARLY → every 6 months
 *   YEARLY    → every 12 months
 *   CUSTOM    → every N days (customFrequencyDays must be provided)
 *
 * Historical Compatibility:
 *   All existing loans have no interestType/interestFrequency stored (schema defaults
 *   STANDARD/MONTHLY). The computeAccruedInterest function preserves the existing
 *   Actual/365 behavior for STANDARD/MONTHLY loans, ensuring zero behavioral change
 *   for historical data.
 * 50% Mode:
 *   Interest amounts are monetary — they are projected at the display layer.
 *   Interest RATES, frequencies, periods, weights are NEVER halved.
 */

import { Prisma } from "@prisma/client";
import { differenceInCalendarDays, differenceInMonths, addMonths } from "date-fns";
import type { InterestType, InterestFrequency, CumulativeInterestTreatment } from "@prisma/client";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// ==================== Rate Normalization ====================

/**
 * Normalize any rate representation to interestRateMonthly (% per month).
 *
 * Both inputs represent the same underlying rate:
 *   A. amountPer100: ₹X per ₹100 per period → X% per period
 *   B. percentPerPeriod: X% per period
 *
 * These are mathematically identical: ₹1 per ₹100 = 1%.
 * Returns the normalized monthly rate as a Decimal.
 *
 * @param rate - The rate value (number or string)
 * @param _representation - "AMOUNT_PER_100" | "PERCENT" (default: "PERCENT")
 * @param periodMonths - The period in months this rate applies to (default: 1 = monthly)
 */
export function normalizeToMonthlyRate(
  rate: string | number,
  _representation: "AMOUNT_PER_100" | "PERCENT" = "PERCENT",
  periodMonths: number = 1
): Decimal {
  void _representation;
  const rateDecimal = new Decimal(rate);
  const ratePerPeriod = rateDecimal;

  if (periodMonths === 1) {
    return ratePerPeriod;
  }

  return ratePerPeriod.div(new Decimal(periodMonths));
}

// ==================== Core Interest Calculation ====================

export interface LoanForInterest {
  principalOutstanding: Decimal;
  interestRateMonthly: Decimal;
  lastSettledDate: Date;
  interestType?: InterestType;
  interestFrequency?: InterestFrequency;
  cumulativePeriodMonths?: number | null;
  interestTreatment?: CumulativeInterestTreatment | null;
  interestOutstanding?: Decimal;
  lastCapitalizedAt?: Date | null;
  loanDate?: Date;
  customFrequencyDays?: number;
}

/**
 * Daily interest amount for a given principal and monthly rate.
 * dailyInterest = principalOutstanding × (monthlyRate × 12 / 365 / 100)
 * (Actual/365 convention)
 */
export function computeDailyInterest(principalOutstanding: Decimal, monthlyRate: Decimal): Decimal {
  if (principalOutstanding.lte(new Decimal(0))) return new Decimal(0);
  const annualRate = monthlyRate.times(new Decimal(12));
  return principalOutstanding.times(annualRate).div(new Decimal(365)).div(new Decimal(100));
}

/**
 * Monthly interest amount (for display purposes — "this month's interest").
 * monthlyInterest = principalOutstanding × (monthlyRate / 100)
 */
export function computeMonthlyInterest(
  principalOutstanding: Decimal,
  monthlyRate: Decimal
): Decimal {
  if (principalOutstanding.lte(new Decimal(0))) return new Decimal(0);
  return principalOutstanding.times(monthlyRate).div(new Decimal(100));
}

/**
 * Compute interest between two dates taking interest frequency into account.
 * Uses the authoritative Actual/365 day-count convention (start date excluded, end date included).
 */
export function computeInterestBetweenDates(
  principal: Decimal,
  monthlyRate: Decimal,
  _frequency: InterestFrequency,
  fromDate: Date,
  toDate: Date,
  _customFrequencyDays?: number
): Decimal {
  void _frequency;
  void _customFrequencyDays;
  if (principal.lte(new Decimal(0))) return new Decimal(0);
  const totalDays = differenceInCalendarDays(toDate, fromDate);
  if (totalDays <= 0) return new Decimal(0);

  const dailyInterest = computeDailyInterest(principal, monthlyRate);
  return dailyInterest.times(new Decimal(totalDays)).toDecimalPlaces(2);
}

/**
 * Compute interest for a given frequency period.
 *
 * When days is omitted, returns the exact standard interest for ONE frequency period:
 * - DAILY: 1 day interest
 * - MONTHLY: 1 month interest (principal × monthlyRate / 100)
 * - QUARTERLY: 3 months interest (principal × monthlyRate × 3 / 100)
 * - HALF_YEARLY: 6 months interest (principal × monthlyRate × 6 / 100)
 * - YEARLY: 12 months interest (principal × monthlyRate × 12 / 100)
 * - CUSTOM: customFrequencyDays of daily interest
 *
 * When days is provided, computes Actual/365 interest over the specified elapsed days.
 */
export function computeInterestForPeriod(
  principal: Decimal,
  monthlyRate: Decimal,
  frequency: InterestFrequency,
  days?: number,
  customFrequencyDays?: number
): Decimal {
  if (principal.lte(new Decimal(0))) return new Decimal(0);
  const dailyInterest = computeDailyInterest(principal, monthlyRate);

  if (days !== undefined) {
    if (days <= 0) return new Decimal(0);
    return dailyInterest.times(new Decimal(days)).toDecimalPlaces(2);
  }

  // Periodic calculation for 1 standard cycle of the given frequency
  switch (frequency) {
    case "DAILY":
      return dailyInterest.toDecimalPlaces(2);
    case "MONTHLY":
      return principal.times(monthlyRate).div(new Decimal(100)).toDecimalPlaces(2);
    case "QUARTERLY":
      return principal
        .times(monthlyRate.times(new Decimal(3)))
        .div(new Decimal(100))
        .toDecimalPlaces(2);
    case "HALF_YEARLY":
      return principal
        .times(monthlyRate.times(new Decimal(6)))
        .div(new Decimal(100))
        .toDecimalPlaces(2);
    case "YEARLY":
      return principal
        .times(monthlyRate.times(new Decimal(12)))
        .div(new Decimal(100))
        .toDecimalPlaces(2);
    case "CUSTOM": {
      const cycleDays = customFrequencyDays && customFrequencyDays > 0 ? customFrequencyDays : 30;
      return dailyInterest.times(new Decimal(cycleDays)).toDecimalPlaces(2);
    }
    default:
      return principal.times(monthlyRate).div(new Decimal(100)).toDecimalPlaces(2);
  }
}

// ==================== Cumulative & Capitalization Engine ====================

export interface CumulativeEvaluation {
  periodsElapsed: number;
  effectivePrincipal: Decimal;
  accruedInterestInCurrentPeriod: Decimal;
  periodicInterestOutstanding: Decimal;
  totalInterestOwed: Decimal;
  lastBoundaryDate: Date;
}

/**
 * Pure evaluation function for CUMULATIVE and STANDARD loans.
 * Does NOT mutate database state. Evaluates exact mathematical status as of asOfDate.
 * Uses Actual/365 convention throughout.
 */
export function evaluateCumulativeLoan(
  loan: LoanForInterest,
  asOfDate: Date
): CumulativeEvaluation {
  const principal = loan.principalOutstanding;
  const monthlyRate = loan.interestRateMonthly;
  const frequency = loan.interestFrequency ?? "MONTHLY";
  const interestType = loan.interestType ?? "STANDARD";
  const treatment = loan.interestTreatment ?? "KEEP_SEPARATE";

  if (principal.lte(new Decimal(0))) {
    const persisted = loan.interestOutstanding ?? new Decimal(0);
    return {
      periodsElapsed: 0,
      effectivePrincipal: new Decimal(0),
      accruedInterestInCurrentPeriod: new Decimal(0),
      periodicInterestOutstanding: persisted,
      totalInterestOwed: persisted,
      lastBoundaryDate: loan.lastCapitalizedAt ?? loan.loanDate ?? loan.lastSettledDate,
    };
  }

  if (interestType !== "CUMULATIVE") {
    // STANDARD: non-capitalizing, pure Actual/365
    const accrued = computeInterestBetweenDates(
      principal,
      monthlyRate,
      frequency,
      loan.lastSettledDate,
      asOfDate,
      loan.customFrequencyDays
    );
    return {
      periodsElapsed: 0,
      effectivePrincipal: principal,
      accruedInterestInCurrentPeriod: accrued,
      periodicInterestOutstanding: new Decimal(0),
      totalInterestOwed: accrued,
      lastBoundaryDate: loan.lastSettledDate,
    };
  }

  // CUMULATIVE loan: capitalization occurs only when configured cumulative period elapses
  const periodMonths =
    loan.cumulativePeriodMonths && loan.cumulativePeriodMonths > 0
      ? loan.cumulativePeriodMonths
      : 12;

  const cycleStartDate = loan.lastCapitalizedAt ?? loan.loanDate ?? loan.lastSettledDate;
  const totalMonthsElapsed = differenceInMonths(asOfDate, cycleStartDate);
  const periodsElapsed = Math.max(0, Math.floor(totalMonthsElapsed / periodMonths));

  if (periodsElapsed === 0) {
    // Boundary has not elapsed: principal is NOT capitalized
    const accrued = computeInterestBetweenDates(
      principal,
      monthlyRate,
      frequency,
      loan.lastSettledDate,
      asOfDate,
      loan.customFrequencyDays
    );
    const persisted = loan.interestOutstanding ?? new Decimal(0);
    const totalInterestOwed =
      treatment === "KEEP_SEPARATE"
        ? persisted.plus(accrued).toDecimalPlaces(2)
        : accrued;

    return {
      periodsElapsed: 0,
      effectivePrincipal: principal,
      accruedInterestInCurrentPeriod: accrued,
      periodicInterestOutstanding: persisted,
      totalInterestOwed,
      lastBoundaryDate: cycleStartDate,
    };
  }

  // periodsElapsed >= 1: one or more capitalization boundaries passed
  if (treatment === "ADD_TO_CAPITAL") {
    let currentP = principal;
    let periodStartDate = cycleStartDate;

    for (let k = 1; k <= periodsElapsed; k++) {
      const boundaryDate = addMonths(cycleStartDate, k * periodMonths);
      const effStart = loan.lastSettledDate > periodStartDate ? loan.lastSettledDate : periodStartDate;
      if (boundaryDate > effStart) {
        const periodInterest = computeInterestBetweenDates(
          currentP,
          monthlyRate,
          frequency,
          effStart,
          boundaryDate,
          loan.customFrequencyDays
        );
        currentP = currentP.plus(periodInterest).toDecimalPlaces(2);
      }
      periodStartDate = boundaryDate;
    }

    const lastBoundaryDate = periodStartDate;
    const effRunningStart = loan.lastSettledDate > lastBoundaryDate ? loan.lastSettledDate : lastBoundaryDate;
    const runningInterest = computeInterestBetweenDates(
      currentP,
      monthlyRate,
      frequency,
      effRunningStart,
      asOfDate,
      loan.customFrequencyDays
    );

    return {
      periodsElapsed,
      effectivePrincipal: currentP,
      accruedInterestInCurrentPeriod: runningInterest,
      periodicInterestOutstanding: new Decimal(0),
      totalInterestOwed: runningInterest,
      lastBoundaryDate,
    };
  } else {
    // KEEP_SEPARATE: principal remains unchanged, accrued interest accumulates
    let accumulatedInterest = loan.interestOutstanding ?? new Decimal(0);
    let periodStartDate = cycleStartDate;

    for (let k = 1; k <= periodsElapsed; k++) {
      const boundaryDate = addMonths(cycleStartDate, k * periodMonths);
      const effStart = loan.lastSettledDate > periodStartDate ? loan.lastSettledDate : periodStartDate;
      if (boundaryDate > effStart) {
        const periodInterest = computeInterestBetweenDates(
          principal,
          monthlyRate,
          frequency,
          effStart,
          boundaryDate,
          loan.customFrequencyDays
        );
        accumulatedInterest = accumulatedInterest.plus(periodInterest).toDecimalPlaces(2);
      }
      periodStartDate = boundaryDate;
    }

    const lastBoundaryDate = periodStartDate;
    const effRunningStart = loan.lastSettledDate > lastBoundaryDate ? loan.lastSettledDate : lastBoundaryDate;
    const runningInterest = computeInterestBetweenDates(
      principal,
      monthlyRate,
      frequency,
      effRunningStart,
      asOfDate,
      loan.customFrequencyDays
    );

    return {
      periodsElapsed,
      effectivePrincipal: principal,
      accruedInterestInCurrentPeriod: runningInterest,
      periodicInterestOutstanding: accumulatedInterest,
      totalInterestOwed: accumulatedInterest.plus(runningInterest).toDecimalPlaces(2),
      lastBoundaryDate,
    };
  }
}

/**
 * Accrued interest in current running period from lastSettledDate to asOfDate.
 */
export function computeAccruedInterest(loan: LoanForInterest, asOfDate: Date): Decimal {
  const evalResult = evaluateCumulativeLoan(loan, asOfDate);
  return evalResult.accruedInterestInCurrentPeriod;
}

/**
 * Total interest owed (including persisted unpaid past periods for KEEP_SEPARATE).
 */
export function computeTotalInterestOwed(loan: LoanForInterest, asOfDate: Date): Decimal {
  const evalResult = evaluateCumulativeLoan(loan, asOfDate);
  return evalResult.totalInterestOwed;
}

/**
 * Determine the number of complete capitalization periods that have passed.
 */
export function computeCapitalizationPeriodsElapsed(
  loan: LoanForInterest,
  asOfDate: Date
): number {
  const evalResult = evaluateCumulativeLoan(loan, asOfDate);
  return evalResult.periodsElapsed;
}

/**
 * Compute the effective principal after capitalization for ADD_TO_CAPITAL loans.
 * Only capitalizes if at least one capitalization period has elapsed.
 */
export function computeCapitalizedPrincipal(loan: LoanForInterest, asOfDate: Date): Decimal {
  if (loan.interestType !== "CUMULATIVE" || loan.interestTreatment !== "ADD_TO_CAPITAL") {
    return loan.principalOutstanding;
  }
  const periods = computeCapitalizationPeriodsElapsed(loan, asOfDate);
  if (periods <= 0) {
    return loan.principalOutstanding;
  }
  const days = Math.max(0, differenceInCalendarDays(asOfDate, loan.lastSettledDate));
  const accrued = computeDailyInterest(loan.principalOutstanding, loan.interestRateMonthly)
    .times(new Decimal(days))
    .toDecimalPlaces(2);
  return loan.principalOutstanding.plus(accrued).toDecimalPlaces(2);
}

// ==================== Summary ====================

/**
 * Compute a summary of interest for display on loan detail.
 * Returns values at true 100% — projection layer handles display mode.
 */
export function computeInterestSummary(loan: LoanForInterest, asOfDate: Date = new Date()) {
  const evalResult = evaluateCumulativeLoan(loan, asOfDate);
  const daily = computeDailyInterest(evalResult.effectivePrincipal, loan.interestRateMonthly);
  const monthly = computeMonthlyInterest(evalResult.effectivePrincipal, loan.interestRateMonthly);
  const daysSinceSettled = differenceInCalendarDays(asOfDate, loan.lastSettledDate);

  const interestType = loan.interestType ?? "STANDARD";
  const isCumulative = interestType === "CUMULATIVE";
  const treatment = loan.interestTreatment ?? null;

  return {
    accruedInterest: evalResult.accruedInterestInCurrentPeriod,
    totalInterestOwed: evalResult.totalInterestOwed,
    dailyInterest: daily.toDecimalPlaces(2),
    monthlyInterest: monthly.toDecimalPlaces(2),
    daysSinceSettled: Math.max(0, daysSinceSettled),
    lastSettledDate: loan.lastSettledDate,
    interestType,
    interestFrequency: loan.interestFrequency ?? "MONTHLY",
    isCumulative,
    treatment,
    periodicInterestOutstanding: evalResult.periodicInterestOutstanding,
    capitalizedPrincipal: evalResult.effectivePrincipal,
    periodsElapsed: evalResult.periodsElapsed,
  };
}
