/**
 * Interest Service — §6.3
 *
 * Flat rate (simple interest) method, Actual/365 day-count convention.
 * Interest is computed on-read, never persisted as an incrementing balance.
 * This is the single source of truth for interest calculations.
 *
 * Formula:
 *   annualRatePercent = interestRateMonthly × 12
 *   dailyInterest = principalOutstanding × (annualRatePercent / 365 / 100)
 *   accruedInterest = dailyInterest × daysBetween(lastSettledDate, asOfDate)
 */

import { Prisma } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { debugLog } from "@/lib/debug";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface LoanForInterest {
  principalOutstanding: Decimal;
  interestRateMonthly: Decimal;
  lastSettledDate: Date;
}

/**
 * Daily interest amount for a given principal and monthly rate.
 * dailyInterest = principalOutstanding × (monthlyRate × 12 / 365 / 100)
 */
export function computeDailyInterest(principalOutstanding: Decimal, monthlyRate: Decimal): Decimal {
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
  return principalOutstanding.times(monthlyRate).div(new Decimal(100));
}

/**
 * Accrued interest from lastSettledDate to asOfDate.
 * Uses Actual/365 day-count convention with day-count-precise proration.
 *
 * accruedInterest = dailyInterest × days
 * Rounded to 2 decimal places.
 */
export function computeAccruedInterest(loan: LoanForInterest, asOfDate: Date): Decimal {
  const days = differenceInCalendarDays(asOfDate, loan.lastSettledDate);

  // No interest if date is same or before lastSettledDate
  if (days <= 0) {
    return new Decimal(0);
  }

  const dailyInterest = computeDailyInterest(loan.principalOutstanding, loan.interestRateMonthly);

  const accrued = dailyInterest.times(new Decimal(days)).toDecimalPlaces(2);
  debugLog(
    "interest",
    `accrued=${accrued.toString()} principal=${loan.principalOutstanding.toString()} rate=${loan.interestRateMonthly.toString()}%/mo days=${days}`
  );
  return accrued;
}

/**
 * Compute a summary of interest for display on loan detail.
 */
export function computeInterestSummary(loan: LoanForInterest, asOfDate: Date = new Date()) {
  const accrued = computeAccruedInterest(loan, asOfDate);
  const daily = computeDailyInterest(loan.principalOutstanding, loan.interestRateMonthly);
  const monthly = computeMonthlyInterest(loan.principalOutstanding, loan.interestRateMonthly);
  const daysSinceSettled = differenceInCalendarDays(asOfDate, loan.lastSettledDate);

  return {
    accruedInterest: accrued,
    dailyInterest: daily.toDecimalPlaces(2),
    monthlyInterest: monthly.toDecimalPlaces(2),
    daysSinceSettled,
    lastSettledDate: loan.lastSettledDate,
  };
}
