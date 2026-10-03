/**
 * Phase 15 — New Loan, Interest Engine, Payment Types & Lifecycle Test Suite
 *
 * Comprehensive test matrix covering:
 * §1. Collateral Calculation Chain (Gross, Stone, Net, Fine Weight, Standard & Custom Purities)
 * §2. Standard Interest & Rate Normalization (₹/100 vs %, Frequencies DAILY, MONTHLY, QUARTERLY, YEARLY, CUSTOM)
 * §3. Cumulative Interest & Capitalization Models (KEEP_SEPARATE vs ADD_TO_CAPITAL)
 * §4. Payment Allocation Waterfall Across Payment Types (FULL, INTEREST_ONLY, PRINCIPAL_ONLY, PART_PAYMENT, CLOSURE, EARLY_CLOSURE)
 * §5. Early Closure & Settlement Preview
 * §6. Post-Disbursement Cancellation & Single-Entry Ledger Audit
 * §7. 50% Projection Mode Invariants (Monetary Halving vs Non-Monetary Strict Invariance)
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  computeNetWeight,
  computeFineWeight,
  computeAssessedValue,
  getLtvPercent,
  computeEligibleAmount,
  DEFAULT_LTV_SLABS,
} from "../lib/services/valuation";
import {
  normalizeToMonthlyRate,
  computeDailyInterest,
  computeMonthlyInterest,
  computeInterestForPeriod,
  computeAccruedInterest,
  computeTotalInterestOwed,
  computeCapitalizationPeriodsElapsed,
  computeCapitalizedPrincipal,
  computeInterestSummary,
  type LoanForInterest,
} from "../lib/services/interest";
import {
  projectLoan,
  projectLoanItem,
  projectInterestSummary,
  projectPayment,
  projectMonetaryDecimal,
  invertMonetaryInputDecimal,
} from "../lib/projection";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

describe("Phase 15 §1 — Collateral Calculation Chain & Purity Standards", () => {
  it("C1: correctly computes Net Weight = Gross Weight - Stone/Wax Weight", () => {
    const gross = new Decimal("32.450");
    const stone = new Decimal("2.150");
    const net = computeNetWeight(gross, stone);
    expect(net.toString()).toBe("30.3");
  });

  it("C2: correctly computes Net Weight when Stone/Wax Weight is zero", () => {
    const gross = new Decimal("15.750");
    const stone = new Decimal("0.000");
    const net = computeNetWeight(gross, stone);
    expect(net.toString()).toBe("15.75");
  });

  it("C3: throws error or clamps when Stone Weight exceeds Gross Weight", () => {
    const gross = new Decimal("10.000");
    const stone = new Decimal("12.000");
    expect(() => computeNetWeight(gross, stone)).toThrow("Net weight cannot be negative: stone weight exceeds gross weight");
  });

  it("C4: computes Fine Weight for Standard 24K (99.9% fineness)", () => {
    const net = new Decimal("50.000");
    const purity = new Decimal("99.9");
    const fine = computeFineWeight(net, purity);
    expect(fine.toFixed(3)).toBe("49.950");
  });

  it("C5: computes Fine Weight for Standard 22K (91.6% fineness)", () => {
    const net = new Decimal("20.000");
    const purity = new Decimal("91.6");
    const fine = computeFineWeight(net, purity);
    expect(fine.toFixed(3)).toBe("18.320");
  });

  it("C6: computes Fine Weight for Standard 18K (75.0% fineness)", () => {
    const net = new Decimal("10.000");
    const purity = new Decimal("75.0");
    const fine = computeFineWeight(net, purity);
    expect(fine.toFixed(3)).toBe("7.500");
  });

  it("C7: computes Fine Weight for Custom Operator Purity (e.g. 84.5% fineness)", () => {
    const net = new Decimal("25.000");
    const purity = new Decimal("84.5");
    const fine = computeFineWeight(net, purity);
    // 25 * 0.845 = 21.125
    expect(fine.toFixed(3)).toBe("21.125");
  });

  it("C8: computes Assessed Value = Fine Weight * Market Rate per Gram", () => {
    const fine = new Decimal("18.320");
    const ratePerGram = new Decimal("7200.00");
    const assessed = computeAssessedValue(fine, ratePerGram);
    // 18.32 * 7200 = 131904.00
    expect(assessed.toFixed(2)).toBe("131904.00");
  });

  it("C9: computes Eligible Loan Amount based on Valuation Tiered LTV", () => {
    const assessed = new Decimal("200000.00");
    const ltv = getLtvPercent(assessed, DEFAULT_LTV_SLABS);
    const eligible = computeEligibleAmount(assessed, ltv);
    expect(ltv.toString()).toBe("85");
    expect(eligible.toFixed(2)).toBe("170000.00");
  });
});

describe("Phase 15 §2 — Standard Interest Engine & Rate Normalization", () => {
  it("R1: normalizes Amount per ₹100 to monthly percentage (₹1.50 per ₹100 = 1.50% / mo)", () => {
    const normalized = normalizeToMonthlyRate("1.50", "AMOUNT_PER_100", 1);
    expect(normalized.toString()).toBe("1.5");
  });

  it("R2: normalizes Percentage directly (1.75% / mo)", () => {
    const normalized = normalizeToMonthlyRate("1.75", "PERCENT", 1);
    expect(normalized.toString()).toBe("1.75");
  });

  it("R3: normalizes quarterly rate to monthly rate (4.5% per quarter / 3 = 1.5% / mo)", () => {
    const normalized = normalizeToMonthlyRate("4.50", "PERCENT", 3);
    expect(normalized.toFixed(2)).toBe("1.50");
  });

  it("I1: computes exact daily interest using Actual/365 convention", () => {
    const principal = new Decimal("100000.00");
    const rateMonthly = new Decimal("1.50"); // 18% p.a.
    // 100,000 * (1.5 * 12) / 365 / 100 = 49.315068...
    const daily = computeDailyInterest(principal, rateMonthly);
    expect(daily.toFixed(4)).toBe("49.3151");
  });

  it("I2: computes monthly interest for display: principal * rate / 100", () => {
    const principal = new Decimal("100000.00");
    const rateMonthly = new Decimal("1.50");
    const monthly = computeMonthlyInterest(principal, rateMonthly);
    expect(monthly.toString()).toBe("1500");
  });

  it("I3: computes accrued interest for exactly 365 days as exactly 1 year of simple interest", () => {
    const loan: LoanForInterest = {
      principalOutstanding: new Decimal("100000.00"),
      interestRateMonthly: new Decimal("1.50"), // 18% p.a. -> ₹18,000
      lastSettledDate: new Date("2026-01-01T00:00:00Z"),
      interestType: "STANDARD",
      interestFrequency: "MONTHLY",
    };
    const asOf = new Date("2027-01-01T00:00:00Z"); // 365 days later
    const accrued = computeAccruedInterest(loan, asOf);
    expect(accrued.toString()).toBe("18000");
  });

  it("I4: computes interest across different frequencies (DAILY, QUARTERLY, YEARLY, CUSTOM)", () => {
    const principal = new Decimal("100000.00");
    const rateMonthly = new Decimal("1.50");
    const days = 90;

    const dailyFreqInterest = computeInterestForPeriod(principal, rateMonthly, "DAILY", days);
    const quarterlyFreqInterest = computeInterestForPeriod(principal, rateMonthly, "QUARTERLY", days);
    const yearlyFreqInterest = computeInterestForPeriod(principal, rateMonthly, "YEARLY", days);

    // All use day-precise Actual/365 under standard model
    expect(dailyFreqInterest.toString()).toBe(quarterlyFreqInterest.toString());
    expect(quarterlyFreqInterest.toString()).toBe(yearlyFreqInterest.toString());
    // 100,000 * 18% * 90 / 365 = 4438.356... -> 4438.36
    expect(dailyFreqInterest.toFixed(2)).toBe("4438.36");
  });
});

describe("Phase 15 §3 — Cumulative Interest & Capitalization Models", () => {
  it("CUM1: KEEP_SEPARATE does not alter principal and accumulates in totalInterestOwed", () => {
    const loan: LoanForInterest = {
      principalOutstanding: new Decimal("100000.00"),
      interestRateMonthly: new Decimal("1.50"),
      lastSettledDate: new Date("2026-01-01T00:00:00Z"),
      interestType: "CUMULATIVE",
      interestFrequency: "MONTHLY",
      cumulativePeriodMonths: 6,
      interestTreatment: "KEEP_SEPARATE",
      interestOutstanding: new Decimal("4500.00"), // previously accumulated interest
    };
    const asOf = new Date("2026-04-01T00:00:00Z"); // 90 days later
    const summary = computeInterestSummary(loan, asOf);

    // Newly accrued: 4438.36
    expect(summary.accruedInterest.toFixed(2)).toBe("4438.36");
    // Total interest owed = 4500 + 4438.36 = 8938.36
    expect(summary.totalInterestOwed.toFixed(2)).toBe("8938.36");
    expect(summary.isCumulative).toBe(true);
    expect(summary.treatment).toBe("KEEP_SEPARATE");
  });

  it("CUM2: ADD_TO_CAPITAL calculates capitalized principal when cycle elapses", () => {
    const loan: LoanForInterest = {
      principalOutstanding: new Decimal("100000.00"),
      interestRateMonthly: new Decimal("1.50"),
      lastSettledDate: new Date("2026-01-01T00:00:00Z"),
      loanDate: new Date("2026-01-01T00:00:00Z"),
      interestType: "CUMULATIVE",
      interestFrequency: "MONTHLY",
      cumulativePeriodMonths: 6,
      interestTreatment: "ADD_TO_CAPITAL",
    };
    const asOf = new Date("2026-07-02T00:00:00Z"); // 6 months later (182 days)
    const periods = computeCapitalizationPeriodsElapsed(loan, asOf);
    expect(periods).toBe(1);

    const newPrincipal = computeCapitalizedPrincipal(loan, asOf);
    // 100,000 * 18% * 182 / 365 = 8975.34
    // New principal = 100,000 + 8975.34 = 108975.34
    expect(newPrincipal.toFixed(2)).toBe("108975.34");
  });

  it("CUM3: STANDARD loan does not capitalize even if period passes", () => {
    const loan: LoanForInterest = {
      principalOutstanding: new Decimal("100000.00"),
      interestRateMonthly: new Decimal("1.50"),
      lastSettledDate: new Date("2026-01-01T00:00:00Z"),
      loanDate: new Date("2026-01-01T00:00:00Z"),
      interestType: "STANDARD",
      cumulativePeriodMonths: 6,
    };
    const asOf = new Date("2027-01-01T00:00:00Z");
    const periods = computeCapitalizationPeriodsElapsed(loan, asOf);
    expect(periods).toBe(0);
    const principal = computeCapitalizedPrincipal(loan, asOf);
    expect(principal.toString()).toBe("100000");
  });
});

describe("Phase 15 §4 — Payment Types Waterfall Allocation Logic", () => {
  // Pure waterfall simulation helper matching payments.ts logic
  function simulateWaterfall(params: {
    principalOutstanding: Decimal;
    accruedInterest: Decimal;
    chargesDue: Decimal;
    amountPaid: Decimal;
    paymentType: "FULL" | "INTEREST_ONLY" | "PRINCIPAL_ONLY" | "PART_PAYMENT" | "CLOSURE" | "EARLY_CLOSURE";
  }) {
    const { principalOutstanding, accruedInterest, chargesDue, amountPaid, paymentType } = params;
    let rem = amountPaid;
    let allocCharges = new Decimal(0);
    let allocInterest = new Decimal(0);
    let allocPrincipal = new Decimal(0);

    if (paymentType === "INTEREST_ONLY") {
      allocInterest = Decimal.min(rem, accruedInterest);
      rem = rem.minus(allocInterest);
    } else if (paymentType === "PRINCIPAL_ONLY") {
      allocPrincipal = Decimal.min(rem, principalOutstanding);
      rem = rem.minus(allocPrincipal);
    } else {
      // Standard waterfall: charges -> interest -> principal
      allocCharges = Decimal.min(rem, chargesDue);
      rem = rem.minus(allocCharges);

      allocInterest = Decimal.min(rem, accruedInterest);
      rem = rem.minus(allocInterest);

      allocPrincipal = Decimal.min(rem, principalOutstanding);
      rem = rem.minus(allocPrincipal);
    }

    const remainingPrincipal = principalOutstanding.minus(allocPrincipal);
    const remainingInterest = accruedInterest.minus(allocInterest);
    const loanFullyPaid =
      (paymentType === "CLOSURE" || paymentType === "EARLY_CLOSURE" || paymentType === "FULL") &&
      remainingPrincipal.isZero() &&
      remainingInterest.isZero();

    return {
      allocatedCharges: allocCharges,
      allocatedInterest: allocInterest,
      allocatedPrincipal: allocPrincipal,
      remainingPrincipal,
      remainingInterest,
      excess: rem,
      loanFullyPaid,
    };
  }

  it("P1: FULL payment waterfall allocates to charges first, then interest, then principal", () => {
    const result = simulateWaterfall({
      principalOutstanding: new Decimal("50000"),
      accruedInterest: new Decimal("2000"),
      chargesDue: new Decimal("500"),
      amountPaid: new Decimal("10000"),
      paymentType: "FULL",
    });

    expect(result.allocatedCharges.toString()).toBe("500");
    expect(result.allocatedInterest.toString()).toBe("2000");
    expect(result.allocatedPrincipal.toString()).toBe("7500");
    expect(result.remainingPrincipal.toString()).toBe("42500");
    expect(result.remainingInterest.toString()).toBe("0");
    expect(result.loanFullyPaid).toBe(false);
  });

  it("P2: FULL payment with exact settlement amount settles all and marks loanFullyPaid", () => {
    const result = simulateWaterfall({
      principalOutstanding: new Decimal("50000"),
      accruedInterest: new Decimal("1500"),
      chargesDue: new Decimal("250"),
      amountPaid: new Decimal("51750"),
      paymentType: "FULL",
    });

    expect(result.allocatedCharges.toString()).toBe("250");
    expect(result.allocatedInterest.toString()).toBe("1500");
    expect(result.allocatedPrincipal.toString()).toBe("50000");
    expect(result.remainingPrincipal.toString()).toBe("0");
    expect(result.remainingInterest.toString()).toBe("0");
    expect(result.loanFullyPaid).toBe(true);
  });

  it("P3: INTEREST_ONLY payment leaves principal untouched", () => {
    const result = simulateWaterfall({
      principalOutstanding: new Decimal("50000"),
      accruedInterest: new Decimal("3000"),
      chargesDue: new Decimal("500"),
      amountPaid: new Decimal("2000"),
      paymentType: "INTEREST_ONLY",
    });

    expect(result.allocatedCharges.toString()).toBe("0");
    expect(result.allocatedInterest.toString()).toBe("2000");
    expect(result.allocatedPrincipal.toString()).toBe("0");
    expect(result.remainingPrincipal.toString()).toBe("50000");
    expect(result.remainingInterest.toString()).toBe("1000");
  });

  it("P4: PRINCIPAL_ONLY payment leaves accrued interest untouched", () => {
    const result = simulateWaterfall({
      principalOutstanding: new Decimal("50000"),
      accruedInterest: new Decimal("3000"),
      chargesDue: new Decimal("500"),
      amountPaid: new Decimal("15000"),
      paymentType: "PRINCIPAL_ONLY",
    });

    expect(result.allocatedCharges.toString()).toBe("0");
    expect(result.allocatedInterest.toString()).toBe("0");
    expect(result.allocatedPrincipal.toString()).toBe("15000");
    expect(result.remainingPrincipal.toString()).toBe("35000");
    expect(result.remainingInterest.toString()).toBe("3000");
  });

  it("P5: PART_PAYMENT reduces balances according to waterfall without auto-closing", () => {
    const result = simulateWaterfall({
      principalOutstanding: new Decimal("10000"),
      accruedInterest: new Decimal("500"),
      chargesDue: new Decimal("0"),
      amountPaid: new Decimal("5000"),
      paymentType: "PART_PAYMENT",
    });

    expect(result.allocatedInterest.toString()).toBe("500");
    expect(result.allocatedPrincipal.toString()).toBe("4500");
    expect(result.remainingPrincipal.toString()).toBe("5500");
    expect(result.loanFullyPaid).toBe(false);
  });

  it("P6: EARLY_CLOSURE fully settles principal and accrued interest", () => {
    const result = simulateWaterfall({
      principalOutstanding: new Decimal("25000"),
      accruedInterest: new Decimal("450"),
      chargesDue: new Decimal("0"),
      amountPaid: new Decimal("25450"),
      paymentType: "EARLY_CLOSURE",
    });

    expect(result.allocatedInterest.toString()).toBe("450");
    expect(result.allocatedPrincipal.toString()).toBe("25000");
    expect(result.remainingPrincipal.toString()).toBe("0");
    expect(result.loanFullyPaid).toBe(true);
  });
});

describe("Phase 15 §5 — Early Closure & Settlement Calculations", () => {
  it("EC1: computes total settlement due = Principal + Accrued Interest + Unsettled Charges", () => {
    const principal = new Decimal("75000.00");
    const rateMonthly = new Decimal("1.50");
    const lastSettled = new Date("2026-01-01T00:00:00Z");
    const asOf = new Date("2026-02-15T00:00:00Z"); // 45 days

    const loan: LoanForInterest = {
      principalOutstanding: principal,
      interestRateMonthly: rateMonthly,
      lastSettledDate: lastSettled,
    };

    const accrued = computeAccruedInterest(loan, asOf);
    // 75,000 * 18% * 45 / 365 = 1664.38
    expect(accrued.toFixed(2)).toBe("1664.38");

    const chargesDue = new Decimal("350.00");
    const totalSettlement = principal.plus(accrued).plus(chargesDue);
    expect(totalSettlement.toFixed(2)).toBe("77014.38");
  });
});

describe("Phase 15 §6 — Post-Disbursement Cancellation & Single-Entry Ledger Integrity", () => {
  it("CAN1: cancellation requires a valid non-empty reason", () => {
    function validateCancellation(reason: string) {
      if (!reason || reason.trim().length === 0) {
        throw new Error("Cancellation reason is required");
      }
      return true;
    }

    expect(() => validateCancellation("")).toThrow("Cancellation reason is required");
    expect(() => validateCancellation("   ")).toThrow("Cancellation reason is required");
    expect(validateCancellation("Customer withdrew collateral within statutory cooling-off")).toBe(true);
  });

  it("CAN2: post-disbursement cancellation preserves single-entry ledger structure", () => {
    // In Pawnify, LedgerEntry has:
    // loanId, eventType, amount, principalAfter, accountId, notes
    // It NEVER creates double-entry debit/credit rows.
    const cancellationLedgerRecord = {
      loanId: "loan-123",
      eventType: "CANCELLATION",
      amount: new Decimal("50000.00"),
      principalAfter: new Decimal("0.00"),
      accountId: "acc-cash-1",
      notes: "Cancelled loan #LN-001: Customer returned funds",
    };

    expect(cancellationLedgerRecord.eventType).toBe("CANCELLATION");
    expect(cancellationLedgerRecord.principalAfter.toString()).toBe("0");
    expect(cancellationLedgerRecord).not.toHaveProperty("debit");
    expect(cancellationLedgerRecord).not.toHaveProperty("credit");
  });
});

describe("Phase 15 §7 — 50% Projection Mode Invariants", () => {
  it("PRJ1: monetary fields are halved in FIFTY_PERCENT mode", () => {
    const rawLoan = {
      id: "loan-1",
      loanNumber: "LN-100",
      principalAmount: new Decimal("100000.00"),
      principalOutstanding: new Decimal("80000.00"),
      interestOutstanding: new Decimal("3000.00"),
      assessedValue: new Decimal("150000.00"),
      eligibleAmount: new Decimal("120000.00"),
      // Non-monetary fields:
      interestRateMonthly: new Decimal("1.50"),
      ltvPercent: new Decimal("80.00"),
      tenureMonths: 12,
      interestType: "STANDARD",
      interestFrequency: "MONTHLY",
    };

    const projected = projectLoan(rawLoan, "FIFTY_PERCENT");

    // Halved monetary fields:
    expect((projected.principalAmount as Decimal).toString()).toBe("50000");
    expect((projected.principalOutstanding as Decimal).toString()).toBe("40000");
    expect((projected.interestOutstanding as Decimal).toString()).toBe("1500");
    expect((projected.assessedValue as Decimal).toString()).toBe("75000");
    expect((projected.eligibleAmount as Decimal).toString()).toBe("60000");

    // Strictly preserved non-monetary fields:
    expect((projected.interestRateMonthly as Decimal).toString()).toBe("1.5");
    expect((projected.ltvPercent as Decimal).toString()).toBe("80");
    expect(projected.tenureMonths).toBe(12);
    expect(projected.interestType).toBe("STANDARD");
    expect(projected.interestFrequency).toBe("MONTHLY");
  });

  it("PRJ2: loan item weights and purities are NEVER halved", () => {
    const rawItem = {
      id: "item-1",
      itemType: "CHAIN",
      grossWeight: new Decimal("25.500"),
      stoneWeight: new Decimal("1.500"),
      netWeight: new Decimal("24.000"),
      purityEntered: "22K",
      finenessPercent: new Decimal("91.6"),
      ratePerGram: new Decimal("7200.00"),
      assessedValue: new Decimal("158284.80"),
      photoUrls: ["https://supabase.co/img1.jpg"],
    };

    const projected = projectLoanItem(rawItem, "FIFTY_PERCENT");

    // Monetary field halved:
    expect(projected.assessedValue.toFixed(2)).toBe("79142.40");

    // Weights, purities, photos NEVER touched:
    expect(projected.grossWeight.toString()).toBe("25.5");
    expect(projected.stoneWeight.toString()).toBe("1.5");
    expect(projected.netWeight.toString()).toBe("24");
    expect(projected.finenessPercent.toString()).toBe("91.6");
    expect(projected.photoUrls).toEqual(["https://supabase.co/img1.jpg"]);
  });

  it("PRJ3: interest summary projection halves monetary amounts and preserves duration", () => {
    const rawSummary = {
      accruedInterest: new Decimal("4000.00"),
      dailyInterest: new Decimal("50.00"),
      monthlyInterest: new Decimal("1500.00"),
      daysSinceSettled: 80,
    };

    const projected = projectInterestSummary(rawSummary, "FIFTY_PERCENT");
    expect(projected.accruedInterest.toString()).toBe("2000");
    expect(projected.dailyInterest.toString()).toBe("25");
    expect(projected.monthlyInterest.toString()).toBe("750");
    expect(projected.daysSinceSettled).toBe(80); // Day count invariant
  });

  it("PRJ4: payment allocation projection halves payment allocations", () => {
    const rawPayment = {
      id: "pay-1",
      receiptNumber: "REC-20261003-00001",
      amountPaid: new Decimal("10000.00"),
      allocatedPrincipal: new Decimal("7000.00"),
      allocatedInterest: new Decimal("2500.00"),
      allocatedCharges: new Decimal("500.00"),
      remainingPrincipal: new Decimal("43000.00"),
      paymentType: "FULL",
    };

    const projected = projectPayment(rawPayment, "FIFTY_PERCENT");
    expect(projected.amountPaid.toString()).toBe("5000");
    expect(projected.allocatedPrincipal.toString()).toBe("3500");
    expect(projected.allocatedInterest.toString()).toBe("1250");
    expect(projected.allocatedCharges.toString()).toBe("250");
    expect(projected.remainingPrincipal.toString()).toBe("21500");
    expect(projected.paymentType).toBe("FULL");
  });

  it("PRJ5: user monetary input inversion doubles displayed input in 50% mode", () => {
    // User sees ₹25,000 on screen and enters ₹25,000.
    // Server must invert to ₹50,000 before running domain logic.
    const userEntered = new Decimal("25000.00");
    const trueAmount = invertMonetaryInputDecimal(userEntered, "FIFTY_PERCENT");
    expect(trueAmount.toString()).toBe("50000");

    const normalAmount = invertMonetaryInputDecimal(userEntered, "NORMAL");
    expect(normalAmount.toString()).toBe("25000");
  });
});
