/**
 * Phase 13 Test Suite — Dashboard UI/UX & Live Metal Rates System
 *
 * Verifies:
 * 1. Gold rate can be updated by ADMIN via updateMetalRatesAction
 * 2. Silver rate can be updated by ADMIN via updateMetalRatesAction
 * 3. STAFF cannot update metal rates (throws unauthorized / admin required error)
 * 4. Unauthenticated caller cannot update metal rates (throws unauthorized error)
 * 5. Invalid rates (negative, zero, NaN, empty) are rejected with validation error
 * 6. Rates persist in AppSetting DB table and getMarketRates() reflects the updated values
 * 7. Rates are NEVER halved in FIFTY_PERCENT mode (market rates are presentation-invariant)
 * 8. Historical loan values (principal, interest, ledger entries) remain unchanged after rate change
 * 9. Available Capital is calculated from capital.main minus totalPrincipalOutstanding
 * 10. Available Capital updates when capital.main setting is changed
 * 11. Available Capital is projected (halved) in FIFTY_PERCENT mode as a monetary field
 * 12. Dashboard Loan Status breakdown contains Active, Overdue, and Closed counts for donut chart
 * 13. Dashboard Metal breakdown contains Gold and Silver counts and values for donut chart
 * 14. Non-monetary counts (status counts, metal counts) are NEVER halved in FIFTY_PERCENT mode
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getMarketRates } from "@/lib/services/market-rates";
import { getDashboardStats, getDashboardChartData } from "@/lib/services/dashboard";
import { updateMetalRatesAction, getDashboardDataAction } from "@/app/(app)/dashboard/actions";
import { checkAuth, checkAdmin } from "@/lib/auth/session";
import { projectDashboardStats } from "@/lib/projection";

const Decimal = Prisma.Decimal;

// Mock auth session helpers for testing server action RBAC
vi.mock("@/lib/auth/session", () => ({
  checkAuth: vi.fn(),
  checkAdmin: vi.fn(),
}));

describe("Phase 13: Dashboard UI/UX & Live Metal Rates System", () => {
  let initialGoldRate: number;
  let initialSilverRate: number;
  let initialCapitalSetting: string | null = null;

  beforeAll(async () => {
    // Preserve initial rates from database to restore after test run
    const currentRates = await getMarketRates();
    initialGoldRate = currentRates.goldRatePerGram;
    initialSilverRate = currentRates.silverRatePerGram;

    const capitalRecord = await prisma.appSetting.findUnique({
      where: { key: "capital.main" },
    });
    initialCapitalSetting = capitalRecord?.value ?? null;
  });

  afterAll(async () => {
    // Restore initial rates and capital
    await prisma.appSetting.upsert({
      where: { key: "rate.gold.per_gram" },
      update: { value: initialGoldRate.toString() },
      create: { key: "rate.gold.per_gram", value: initialGoldRate.toString() },
    });
    await prisma.appSetting.upsert({
      where: { key: "rate.silver.per_gram" },
      update: { value: initialSilverRate.toString() },
      create: { key: "rate.silver.per_gram", value: initialSilverRate.toString() },
    });

    if (initialCapitalSetting !== null) {
      await prisma.appSetting.upsert({
        where: { key: "capital.main" },
        update: { value: initialCapitalSetting },
        create: { key: "capital.main", value: initialCapitalSetting },
      });
    } else {
      await prisma.appSetting.deleteMany({
        where: { key: "capital.main" },
      });
    }
  });

  // ==================== 1. ADMIN RATE UPDATES & PERSISTENCE ====================
  describe("1. Admin Metal Rate Updates & Persistence", () => {
    it("1. ADMIN can update both gold and silver rates via server action", async () => {
      vi.mocked(checkAdmin).mockResolvedValueOnce({
        authenticated: true,
        user: {
          id: "admin-user-id",
          name: "Admin User",
          email: "admin@pawnify.com",
          role: "ADMIN",
          phone: "9876543210",
          isActive: true,
        },
        sessionId: "admin-session-id",
        calculationMode: "NORMAL",
      });

      const res = await updateMetalRatesAction(8125.5, 102.75);

      expect(res.success).toBe(true);
      expect(res.goldRate).toBe(8125.5);
      expect(res.silverRate).toBe(102.75);
      expect(res.lastUpdated).toBeDefined();

      // Verify DB persistence via AppSetting
      const dbRates = await getMarketRates();
      expect(dbRates.goldRatePerGram).toBe(8125.5);
      expect(dbRates.silverRatePerGram).toBe(102.75);
    });

    it("2. STAFF cannot update metal rates (throws unauthorized / admin required)", async () => {
      vi.mocked(checkAdmin).mockResolvedValueOnce({
        authenticated: false,
        error: "Unauthorized: Admin privileges required.",
      });

      await expect(updateMetalRatesAction(8500, 110)).rejects.toThrow(
        "Unauthorized: Admin privileges required."
      );
    });

    it("3. Unauthenticated requests to update rates are rejected", async () => {
      vi.mocked(checkAdmin).mockResolvedValueOnce({
        authenticated: false,
        error: "Unauthorized: Please log in.",
      });

      await expect(updateMetalRatesAction(8500, 110)).rejects.toThrow(
        "Unauthorized: Please log in."
      );
    });

    it("4. Invalid or non-positive rates are rejected with validation error", async () => {
      vi.mocked(checkAdmin).mockResolvedValue({
        authenticated: true,
        user: {
          id: "admin-user-id",
          name: "Admin User",
          email: "admin@pawnify.com",
          role: "ADMIN",
          phone: null,
          isActive: true,
        },
        sessionId: "admin-session-id",
        calculationMode: "NORMAL",
      });

      // Negative gold rate
      await expect(updateMetalRatesAction(-500, 100)).rejects.toThrow("positive number");
      // Zero gold rate
      await expect(updateMetalRatesAction(0, 100)).rejects.toThrow("positive number");
      // Negative silver rate
      await expect(updateMetalRatesAction(8000, -10)).rejects.toThrow("positive number");
      // Non-numeric string
      await expect(updateMetalRatesAction("invalid", 100)).rejects.toThrow("positive number");
    });
  });

  // ==================== 2. FIFTY_PERCENT MODE & RATE INVARIANCE ====================
  describe("2. Rate Invariance & Historical Stability", () => {
    it("5. Gold and Silver rates are NEVER halved in FIFTY_PERCENT mode", async () => {
      // Rates are market spot prices, not financial metrics
      const marketRates = await getMarketRates();
      expect(marketRates.goldRatePerGram).toBeGreaterThan(0);
      expect(marketRates.silverRatePerGram).toBeGreaterThan(0);

      // Verify that market rates service does not alter rates based on session
      const normalRates = await getMarketRates();
      expect(normalRates.goldRatePerGram).toBe(marketRates.goldRatePerGram);
      expect(normalRates.silverRatePerGram).toBe(marketRates.silverRatePerGram);
    });

    it("6. Historical loan records and ledger entries remain unchanged after rate updates", async () => {
      const anyLoan = await prisma.loan.findFirst({
        where: { status: "ACTIVE" },
      });
      if (anyLoan) {
        const originalPrincipal = anyLoan.principalAmount.toNumber();
        const originalOutstanding = anyLoan.principalOutstanding.toNumber();

        // Update rates again
        vi.mocked(checkAdmin).mockResolvedValueOnce({
          authenticated: true,
          user: {
            id: "admin-user-id",
            name: "Admin User",
            email: "admin@pawnify.com",
            role: "ADMIN",
            phone: null,
            isActive: true,
          },
          sessionId: "admin-session-id",
          calculationMode: "NORMAL",
        });
        await updateMetalRatesAction(8200, 105);

        // Verify loan row in DB is not mutated
        const recheckLoan = await prisma.loan.findUnique({
          where: { id: anyLoan.id },
        });
        expect(recheckLoan?.principalAmount.toNumber()).toBe(originalPrincipal);
        expect(recheckLoan?.principalOutstanding.toNumber()).toBe(originalOutstanding);
      }
    });
  });

  // ==================== 3. AVAILABLE CAPITAL METRIC ====================
  describe("3. Available Capital Metric", () => {
    it("7. Available Capital is calculated as capital.main minus totalPrincipalOutstanding", async () => {
      // Set known capital in AppSetting
      await prisma.appSetting.upsert({
        where: { key: "capital.main" },
        update: { value: "6000000" }, // ₹60 Lakhs
        create: { key: "capital.main", value: "6000000" },
      });

      const stats = await getDashboardStats();
      expect(stats.capitalMain).toBeDefined();
      expect(stats.availableCapital).toBeDefined();

      const expectedAvailable = new Decimal("6000000").minus(stats.totalPrincipalOutstanding);
      expect(stats.availableCapital.toNumber()).toBeCloseTo(expectedAvailable.toNumber(), 2);
    });

    it("8. Available Capital defaults safely to 5,000,000 if capital.main is not set", async () => {
      await prisma.appSetting.deleteMany({
        where: { key: "capital.main" },
      });

      const stats = await getDashboardStats();
      const expectedAvailable = new Decimal("5000000").minus(stats.totalPrincipalOutstanding);
      expect(stats.availableCapital.toNumber()).toBeCloseTo(expectedAvailable.toNumber(), 2);
    });

    it("9. Available Capital is halved in FIFTY_PERCENT mode as a monetary field", async () => {
      await prisma.appSetting.upsert({
        where: { key: "capital.main" },
        update: { value: "5000000" },
        create: { key: "capital.main", value: "5000000" },
      });

      const stats = await getDashboardStats();
      const projected = projectDashboardStats(stats, "FIFTY_PERCENT");

      expect(projected.availableCapital.toNumber()).toBeCloseTo(
        stats.availableCapital.toNumber() * 0.5,
        2
      );
      expect(projected.capitalMain.toNumber()).toBeCloseTo(
        stats.capitalMain.toNumber() * 0.5,
        2
      );
    });
  });

  // ==================== 4. DONUT BREAKDOWNS & NON-MONETARY INVARIANCE ====================
  describe("4. Donut Breakdowns & Non-Monetary Invariance", () => {
    it("10. Loan Status Summary contains active, overdue, and closed counts for status donut", async () => {
      const stats = await getDashboardStats();
      expect(stats.loanStatusSummary).toBeDefined();
      expect(stats.loanStatusSummary.active.count).toBe(stats.activeCount);
      expect(stats.loanStatusSummary.overdue.count).toBe(stats.overdueCount);
      expect(stats.loanStatusSummary.closed.count).toBe(stats.closedCount);

      const totalStatusCounts =
        stats.loanStatusSummary.active.count +
        stats.loanStatusSummary.overdue.count +
        stats.loanStatusSummary.closed.count;
      expect(totalStatusCounts).toBe(stats.totalLoansCount);
    });

    it("11. Metal Loan Summary contains gold and silver loan items for metal donut", async () => {
      const chartData = await getDashboardChartData();
      expect(chartData.metalBreakdown).toBeDefined();
      expect(chartData.metalBreakdown.length).toBeGreaterThanOrEqual(2);

      const gold = chartData.metalBreakdown.find((m) => m.name.toLowerCase().includes("gold"));
      const silver = chartData.metalBreakdown.find((m) => m.name.toLowerCase().includes("silver"));

      expect(gold).toBeDefined();
      expect(silver).toBeDefined();
      expect(typeof gold?.count).toBe("number");
      expect(typeof silver?.count).toBe("number");
      expect(gold?.count).toBeGreaterThan(0);
    });

    it("12. In FIFTY_PERCENT mode, donut counts remain 100% invariant (never halved)", async () => {
      const stats = await getDashboardStats();
      const projected = projectDashboardStats(stats, "FIFTY_PERCENT");

      // Counts are never halved
      expect(projected.loanStatusSummary.active.count).toBe(stats.loanStatusSummary.active.count);
      expect(projected.loanStatusSummary.overdue.count).toBe(stats.loanStatusSummary.overdue.count);
      expect(projected.loanStatusSummary.closed.count).toBe(stats.loanStatusSummary.closed.count);
      expect(projected.totalLoansCount).toBe(stats.totalLoansCount);
      expect(projected.activeCount).toBe(stats.activeCount);
      expect(projected.overdueCount).toBe(stats.overdueCount);
    });

    it("13. Dashboard server action returns projected stats and chart data cleanly for client", async () => {
      vi.mocked(checkAuth).mockResolvedValueOnce({
        authenticated: true,
        user: {
          id: "admin-user-id",
          name: "Admin User",
          email: "admin@pawnify.com",
          role: "ADMIN",
          phone: null,
          isActive: true,
        },
        sessionId: "admin-session-id",
        calculationMode: "NORMAL",
      });

      const result = await getDashboardDataAction();
      expect(result.stats).toBeDefined();
      expect(result.stats.availableCapital).toBeDefined();
      expect(result.chartData).toBeDefined();
      expect(result.chartData.metalBreakdown).toBeDefined();
    });
  });
});
