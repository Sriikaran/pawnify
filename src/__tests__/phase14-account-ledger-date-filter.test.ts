/**
 * Phase 14 Test Suite — Account Ledger Date Filter Redesign
 *
 * Verifies:
 * 1. Today filter returns only entries created on today's calendar date.
 * 2. Yesterday filter returns only entries created on yesterday's calendar date.
 * 3. Single Date filter returns entries belonging strictly to that specific date.
 * 4. Date Range filter returns entries spanning across multiple dates within the bounds.
 * 5. Date Range start boundary is strictly inclusive (00:00:00.000).
 * 6. Date Range end boundary is strictly inclusive (23:59:59.999).
 * 7. Same From and To date behaves identically to a single calendar day.
 * 8. From Date > To Date is cleanly rejected with a user-facing validation message.
 * 9. Missing From/To or invalid/malformed date formats are cleanly rejected.
 * 10. Account + Date filter work together with strict account isolation.
 * 11. Account + Date Range work together with strict account isolation.
 * 12. Account + Search filter works together.
 * 13. Account + Date Range + Search all work together with AND semantics.
 * 14. Summary totals (Inflow/Outflow/Net) correspond strictly to the selected period.
 * 15. Opening balance derives from transactions strictly before the selected date range.
 * 16. Closing balance exactly equals Opening Balance + Net Movement.
 * 17. Transaction count strictly matches the selected period entries.
 * 18. Running balance advances correctly from opening balance through each transaction.
 * 19. 50% calculation mode preserves dates and counts while halving monetary balances.
 * 20. Existing Account Ledger service behavior and baseline invariants remain intact.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getAccountLedger } from "@/lib/services/account-ledger";
import { getAccountLedgerAction } from "@/app/(app)/account-ledger/actions";

// Mock session auth so getAccountLedgerAction can be tested directly
vi.mock("@/lib/auth/session", () => ({
  checkAuth: vi.fn().mockResolvedValue({
    authenticated: true,
    user: { id: "test-user-id", role: "ADMIN" },
    calculationMode: "NORMAL",
  }),
}));

let testLoanId: string;
let primaryAccountId: string;
let secondaryAccountId: string;

const createdLedgerIds: string[] = [];
const createdAccountIds: string[] = [];

function trackLedger(id: string) {
  createdLedgerIds.push(id);
  return id;
}

function trackAccount(id: string) {
  createdAccountIds.push(id);
  return id;
}

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getYesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

describe("Phase 14: Account Ledger Date Filter Redesign Tests", () => {
  beforeAll(async () => {
    // 1. Existing loan for ledger postings
    const loan = await prisma.loan.findFirst({
      select: { id: true },
    });
    if (!loan) throw new Error("A loan must exist in the database for tests.");
    testLoanId = loan.id;

    // 2. Primary Account
    const primaryAcc = await prisma.accountMaster.create({
      data: {
        code: `TEST-P14-PRI-${Date.now()}`.toUpperCase(),
        name: `Primary P14 Test Account ${Date.now()}`,
        type: "ASSET",
        isActive: true,
      },
    });
    primaryAccountId = trackAccount(primaryAcc.id);

    // 3. Secondary Account (to test account isolation)
    const secondaryAcc = await prisma.accountMaster.create({
      data: {
        code: `TEST-P14-SEC-${Date.now()}`.toUpperCase(),
        name: `Secondary P14 Test Account ${Date.now()}`,
        type: "ASSET",
        isActive: true,
      },
    });
    secondaryAccountId = trackAccount(secondaryAcc.id);

    // 4. Seed Today's entries
    const now = new Date();
    const eTodayPay = await prisma.ledgerEntry.create({
      data: {
        loanId: testLoanId,
        accountId: primaryAccountId,
        type: "PAYMENT",
        amount: new Prisma.Decimal("500.00"),
        principalAfter: new Prisma.Decimal("9500.00"),
        description: "P14 Today Inflow",
        referenceId: "P14-REF-TODAY",
        createdAt: now,
      },
    });
    trackLedger(eTodayPay.id);

    // 5. Seed Yesterday's entries
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    yest.setHours(12, 0, 0, 0);

    const eYestDisb = await prisma.ledgerEntry.create({
      data: {
        loanId: testLoanId,
        accountId: primaryAccountId,
        type: "DISBURSEMENT",
        amount: new Prisma.Decimal("300.00"),
        principalAfter: new Prisma.Decimal("9800.00"),
        description: "P14 Yesterday Outflow",
        referenceId: "P14-REF-YESTERDAY",
        createdAt: yest,
      },
    });
    trackLedger(eYestDisb.id);

    // 6. Seed Specific Date Range entries in June 2026:
    // Past entry (Prior to June 2026, for opening balance)
    const priorDate = new Date("2026-05-15T10:00:00");
    const ePriorInflow = await prisma.ledgerEntry.create({
      data: {
        loanId: testLoanId,
        accountId: primaryAccountId,
        type: "PAYMENT",
        amount: new Prisma.Decimal("1000.00"),
        principalAfter: new Prisma.Decimal("10000.00"),
        description: "P14 Prior Period Inflow",
        createdAt: priorDate,
      },
    });
    trackLedger(ePriorInflow.id);

    const ePriorOutflow = await prisma.ledgerEntry.create({
      data: {
        loanId: testLoanId,
        accountId: primaryAccountId,
        type: "DISBURSEMENT",
        amount: new Prisma.Decimal("400.00"),
        principalAfter: new Prisma.Decimal("10400.00"),
        description: "P14 Prior Period Outflow",
        createdAt: priorDate,
      },
    });
    trackLedger(ePriorOutflow.id);

    // Start boundary entry (June 1, 2026 morning)
    const juneStart = new Date("2026-06-01T08:30:00");
    const eJuneStart = await prisma.ledgerEntry.create({
      data: {
        loanId: testLoanId,
        accountId: primaryAccountId,
        type: "PAYMENT",
        amount: new Prisma.Decimal("600.00"),
        principalAfter: new Prisma.Decimal("9800.00"),
        description: "P14 June Start Inflow",
        referenceId: "P14-REF-JUNE-START",
        createdAt: juneStart,
      },
    });
    trackLedger(eJuneStart.id);

    // Mid-range entry (June 15, 2026 midday)
    const juneMid = new Date("2026-06-15T12:00:00");
    const eJuneMid = await prisma.ledgerEntry.create({
      data: {
        loanId: testLoanId,
        accountId: primaryAccountId,
        type: "DISBURSEMENT",
        amount: new Prisma.Decimal("250.00"),
        principalAfter: new Prisma.Decimal("10050.00"),
        description: "P14 June Mid Outflow UniqueSearchTerm",
        referenceId: "P14-REF-SEARCH-TARGET",
        createdAt: juneMid,
      },
    });
    trackLedger(eJuneMid.id);

    // End boundary entry (June 30, 2026 evening)
    const juneEnd = new Date("2026-06-30T18:45:00");
    const eJuneEnd = await prisma.ledgerEntry.create({
      data: {
        loanId: testLoanId,
        accountId: primaryAccountId,
        type: "PAYMENT",
        amount: new Prisma.Decimal("350.00"),
        principalAfter: new Prisma.Decimal("9700.00"),
        description: "P14 June End Inflow",
        referenceId: "P14-REF-JUNE-END",
        createdAt: juneEnd,
      },
    });
    trackLedger(eJuneEnd.id);

    // Future entry outside range (July 5, 2026)
    const julyAfter = new Date("2026-07-05T10:00:00");
    const eJulyAfter = await prisma.ledgerEntry.create({
      data: {
        loanId: testLoanId,
        accountId: primaryAccountId,
        type: "PAYMENT",
        amount: new Prisma.Decimal("800.00"),
        principalAfter: new Prisma.Decimal("8900.00"),
        description: "P14 July Future Inflow UniqueSearchTerm",
        createdAt: julyAfter,
      },
    });
    trackLedger(eJulyAfter.id);

    // Secondary Account entry on June 15 (for isolation verification)
    const eSecondaryMid = await prisma.ledgerEntry.create({
      data: {
        loanId: testLoanId,
        accountId: secondaryAccountId,
        type: "PAYMENT",
        amount: new Prisma.Decimal("999.00"),
        principalAfter: new Prisma.Decimal("5000.00"),
        description: "P14 Secondary Account June Inflow",
        referenceId: "P14-REF-SEC-JUNE",
        createdAt: juneMid,
      },
    });
    trackLedger(eSecondaryMid.id);
  });

  afterAll(async () => {
    if (createdLedgerIds.length > 0) {
      await prisma.ledgerEntry.deleteMany({
        where: { id: { in: createdLedgerIds } },
      });
    }
    if (createdAccountIds.length > 0) {
      await prisma.accountMaster.deleteMany({
        where: { id: { in: createdAccountIds } },
      });
    }
  });

  // 1. Today filter
  it("1. Today filter: returns only transactions created today", async () => {
    const today = getTodayStr();
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: today,
      endDate: today,
    });

    expect(result.entries.length).toBeGreaterThanOrEqual(1);
    const hasTodayEntry = result.entries.some((e) => e.description === "P14 Today Inflow");
    expect(hasTodayEntry).toBe(true);

    const hasPastEntry = result.entries.some((e) => e.description === "P14 Yesterday Outflow");
    expect(hasPastEntry).toBe(false);
  });

  // 2. Yesterday filter
  it("2. Yesterday filter: returns only transactions created yesterday", async () => {
    const yesterday = getYesterdayStr();
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: yesterday,
      endDate: yesterday,
    });

    expect(result.entries.length).toBeGreaterThanOrEqual(1);
    const hasYestEntry = result.entries.some((e) => e.description === "P14 Yesterday Outflow");
    expect(hasYestEntry).toBe(true);

    const hasTodayEntry = result.entries.some((e) => e.description === "P14 Today Inflow");
    expect(hasTodayEntry).toBe(false);
  });

  // 3. Single Date filter
  it("3. Single Date filter: returns transactions belonging strictly to that calendar date", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-15",
      endDate: "2026-06-15",
    });

    expect(result.entries.length).toBe(1);
    expect(result.entries[0].description).toBe("P14 June Mid Outflow UniqueSearchTerm");
    expect(result.entries[0].type).toBe("DISBURSEMENT");
  });

  // 4. Date Range filter
  it("4. Date Range filter: returns transactions spanning the range across multiple dates", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(result.entries.length).toBe(3);
    const descriptions = result.entries.map((e) => e.description);
    expect(descriptions).toContain("P14 June Start Inflow");
    expect(descriptions).toContain("P14 June Mid Outflow UniqueSearchTerm");
    expect(descriptions).toContain("P14 June End Inflow");

    // Entries outside June 2026 are excluded
    expect(descriptions).not.toContain("P14 Prior Period Inflow");
    expect(descriptions).not.toContain("P14 July Future Inflow UniqueSearchTerm");
  });

  // 5. Date Range start is inclusive
  it("5. Date Range start is inclusive: entries on the start day are included", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-01",
      endDate: "2026-06-10",
    });

    const hasStartEntry = result.entries.some((e) => e.description === "P14 June Start Inflow");
    expect(hasStartEntry).toBe(true);
  });

  // 6. Date Range end is inclusive
  it("6. Date Range end is inclusive: entries on the end day are included", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-20",
      endDate: "2026-06-30",
    });

    const hasEndEntry = result.entries.some((e) => e.description === "P14 June End Inflow");
    expect(hasEndEntry).toBe(true);
  });

  // 7. Same From/To date behaves as one calendar day
  it("7. Same From/To date behaves as one calendar day", async () => {
    const rangeResult = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-15",
      endDate: "2026-06-15",
    });

    expect(rangeResult.entries.length).toBe(1);
    expect(rangeResult.entries[0].referenceId).toBe("P14-REF-SEARCH-TARGET");
  });

  // 8. From Date > To Date is rejected
  it("8. From Date > To Date is rejected with a clean validation error", async () => {
    await expect(
      getAccountLedgerAction({
        accountId: primaryAccountId,
        startDate: "2026-06-30",
        endDate: "2026-06-01",
      })
    ).rejects.toThrow("From date cannot be after To date. Please fix the date range.");
  });

  // 9. Invalid date is rejected
  it("9. Missing or malformed date inputs are rejected with clean messages", async () => {
    await expect(
      getAccountLedgerAction({
        accountId: primaryAccountId,
        startDate: "invalid-date",
        endDate: "2026-06-30",
      })
    ).rejects.toThrow("From date is invalid. Please enter a valid date.");

    await expect(
      getAccountLedgerAction({
        accountId: primaryAccountId,
        startDate: "2026-06-01",
        endDate: "not-a-date",
      })
    ).rejects.toThrow("To date is invalid. Please enter a valid date.");

    await expect(
      getAccountLedgerAction({
        accountId: primaryAccountId,
        startDate: "2026-06-01",
        endDate: "",
      })
    ).rejects.toThrow("To date is required when From date is specified.");

    await expect(
      getAccountLedgerAction({
        accountId: primaryAccountId,
        startDate: "",
        endDate: "2026-06-30",
      })
    ).rejects.toThrow("From date is required when To date is specified.");
  });

  // 10. Account + Date filter works together
  it("10. Account + Date filter works together with strict account isolation", async () => {
    const primaryResult = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-15",
      endDate: "2026-06-15",
    });

    const secondaryResult = await getAccountLedger({
      accountId: secondaryAccountId,
      startDate: "2026-06-15",
      endDate: "2026-06-15",
    });

    expect(primaryResult.entries.length).toBe(1);
    expect(primaryResult.entries[0].accountId).toBe(primaryAccountId);
    expect(primaryResult.entries[0].amount.toString()).toBe("250");

    expect(secondaryResult.entries.length).toBe(1);
    expect(secondaryResult.entries[0].accountId).toBe(secondaryAccountId);
    expect(secondaryResult.entries[0].amount.toString()).toBe("999");
  });

  // 11. Account + Date Range works together
  it("11. Account + Date Range works together with strict account isolation", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    for (const entry of result.entries) {
      expect(entry.accountId).toBe(primaryAccountId);
      expect(entry.accountId).not.toBe(secondaryAccountId);
    }
  });

  // 12. Account + Search works
  it("12. Account + Search works: filters by search term within account", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      search: "P14-REF-TODAY",
    });

    expect(result.entries.length).toBe(1);
    expect(result.entries[0].referenceId).toBe("P14-REF-TODAY");
  });

  // 13. Account + Date Range + Search works together
  it("13. Account + Date Range + Search works together with AND semantics", async () => {
    // Both June Mid and July Future have "UniqueSearchTerm"
    // When date range is June 2026, ONLY June Mid should be returned
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      search: "UniqueSearchTerm",
    });

    expect(result.entries.length).toBe(1);
    expect(result.entries[0].description).toBe("P14 June Mid Outflow UniqueSearchTerm");
    expect(result.entries[0].referenceId).toBe("P14-REF-SEARCH-TARGET");
  });

  // 14. Summary totals correspond to the selected period
  it("14. Summary totals correspond strictly to the selected period", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    // Inflows in June: 600 + 350 = 950.00
    expect(result.summary.totalInflow.toString()).toBe("950");
    // Outflows in June: 250.00
    expect(result.summary.totalOutflow.toString()).toBe("250");
    // Net Movement: 950 - 250 = 700.00
    expect(result.summary.netMovement.toString()).toBe("700");
  });

  // 15. Opening balance is calculated from transactions before the selected range
  it("15. Opening balance is calculated from transactions strictly prior to selected range", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    // Prior entries before June 1, 2026:
    // Inflow: 1000.00
    // Outflow: 400.00
    // Opening balance = 1000 - 400 = 600.00
    expect(result.summary.openingBalance.toString()).toBe("600");
  });

  // 16. Closing balance equals Opening Balance + Net Movement
  it("16. Closing balance equals Opening Balance + Net Movement", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    const opening = parseFloat(result.summary.openingBalance.toString());
    const net = parseFloat(result.summary.netMovement.toString());
    const closing = parseFloat(result.summary.closingBalance.toString());

    expect(closing).toBe(opening + net);
    expect(result.summary.closingBalance.toString()).toBe("1300");
  });

  // 17. Transaction count matches the selected range
  it("17. Transaction count strictly matches the selected range", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(result.summary.transactionCount).toBe(3);
    expect(result.entries.length).toBe(result.summary.transactionCount);
  });

  // 18. Existing running balance remains correct
  it("18. Running balance accumulates dynamically and chronologically across the period", async () => {
    const result = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    // Opening = 600.00
    // Entry 1 (June 1): Inflow +600 => running balance = 1200.00
    expect(result.entries[0].runningBalance.toString()).toBe("1200");

    // Entry 2 (June 15): Outflow -250 => running balance = 950.00
    expect(result.entries[1].runningBalance.toString()).toBe("950");

    // Entry 3 (June 30): Inflow +350 => running balance = 1300.00 (matches closing balance)
    expect(result.entries[2].runningBalance.toString()).toBe("1300");
    expect(result.entries[2].runningBalance.toString()).toBe(result.summary.closingBalance.toString());
  });

  // 19. Existing 50% mode remains correct
  it("19. FIFTY_PERCENT mode halves monetary values without altering counts, dates, or filtering", async () => {
    const result = await getAccountLedger(
      {
        accountId: primaryAccountId,
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      "FIFTY_PERCENT"
    );

    // True Opening 600 * 0.5 = 300
    expect(result.summary.openingBalance.toString()).toBe("300");
    // True Inflow 950 * 0.5 = 475
    expect(result.summary.totalInflow.toString()).toBe("475");
    // True Outflow 250 * 0.5 = 125
    expect(result.summary.totalOutflow.toString()).toBe("125");
    // True Net Movement 700 * 0.5 = 350
    expect(result.summary.netMovement.toString()).toBe("350");
    // True Closing 1300 * 0.5 = 650
    expect(result.summary.closingBalance.toString()).toBe("650");

    // Counts remain unhalved
    expect(result.summary.transactionCount).toBe(3);
    expect(result.entries.length).toBe(3);

    // Row running balances are halved:
    // Entry 1: 1200 * 0.5 = 600
    expect(result.entries[0].runningBalance.toString()).toBe("600");
    // Entry 2: 950 * 0.5 = 475
    expect(result.entries[1].runningBalance.toString()).toBe("475");
    // Entry 3: 1300 * 0.5 = 650
    expect(result.entries[2].runningBalance.toString()).toBe("650");
  });

  // 20. Existing Account Ledger tests continue passing
  it("20. Existing Account Ledger empty query behavior and defaults remain intact", async () => {
    const emptyResult = await getAccountLedger({
      accountId: primaryAccountId,
      startDate: "2020-01-01",
      endDate: "2020-01-02",
    });

    expect(emptyResult.entries.length).toBe(0);
    expect(emptyResult.summary.transactionCount).toBe(0);
    expect(emptyResult.summary.totalInflow.toString()).toBe("0");
    expect(emptyResult.summary.totalOutflow.toString()).toBe("0");
    expect(emptyResult.summary.netMovement.toString()).toBe("0");
  });
});
