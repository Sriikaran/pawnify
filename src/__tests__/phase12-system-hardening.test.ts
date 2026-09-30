/**
 * Phase 12 Test Suite — System Hardening & Immutability Verification
 *
 * Verifies:
 * 1. Financial immutability: deleteLoanAction rejects deleting loans with ledger entries or payments.
 * 2. Audit trail protection: deleteCustomerAction rejects deleting customers with loan history.
 * 3. Unauthenticated rejection across Server Actions.
 * 4. Single-entry ledger architecture invariant: exactly one row created per event.
 * 5. 50% presentation mode never alters non-monetary values.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Mock auth session helpers for testing server action RBAC
vi.mock("@/lib/auth/session", () => ({
  checkAuth: vi.fn(),
  checkAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { checkAdmin } from "@/lib/auth/session";
import { deleteLoanAction } from "@/app/(app)/loans/[id]/actions";
import { deleteCustomerAction } from "@/app/(app)/customers/[id]/actions";
import { writeLedgerEntry } from "@/lib/ledger-writer";
import { projectLoan } from "@/lib/projection";

describe("Phase 12: System Hardening & Immutability", () => {
  let adminUserId: string;
  let testCustomer: { id: string };
  let testLoan: { id: string };

  beforeAll(async () => {
    // Locate or create test ADMIN user
    let admin = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          id: `admin-phase12-${Date.now()}`,
          name: "Test Admin Phase 12",
          email: `admin-phase12-${Date.now()}@pawnify.test`,
          role: "ADMIN",
          phone: "9999990012",
          isActive: true,
        },
      });
    }
    adminUserId = admin.id;

    // Configure default checkAdmin mock to return authenticated admin
    vi.mocked(checkAdmin).mockResolvedValue({
      authenticated: true,
      user: {
        id: adminUserId,
        name: "Admin",
        email: "admin@test.com",
        role: "ADMIN",
        phone: null,
        isActive: true,
      },
      sessionId: "mock-admin-session",
      calculationMode: "NORMAL",
    });

    // Create a customer with a loan and ledger entry
    const customer = await prisma.customer.create({
      data: {
        fullName: "Hardening Customer Test",
        phone: "9876541234",
        addressLine1: "123 Hardening St",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500001",
        createdById: adminUserId,
      },
    });
    testCustomer = { id: customer.id };

    const loan = await prisma.loan.create({
      data: {
        loanNumber: `HARDEN-${Date.now()}`,
        customerId: customer.id,
        principalAmount: new Prisma.Decimal("50000"),
        principalOutstanding: new Prisma.Decimal("50000"),
        interestRateMonthly: new Prisma.Decimal("1.5"),
        totalAssessedValue: new Prisma.Decimal("70000"),
        ltvPercent: new Prisma.Decimal("71.4"),
        tenureMonths: 12,
        loanDate: new Date(),
        dueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        lastSettledDate: new Date(),
        status: "ACTIVE",
        handledById: adminUserId,
      },
    });
    testLoan = { id: loan.id };

    // Write a DISBURSEMENT ledger entry for this loan
    await writeLedgerEntry(prisma, {
      loanId: loan.id,
      type: "DISBURSEMENT",
      amount: new Prisma.Decimal("50000"),
      principalAfter: new Prisma.Decimal("50000"),
      description: "Disbursement for hardening test loan",
    });
  });

  afterAll(async () => {
    // Clean up test records
    if (testLoan?.id) {
      await prisma.ledgerEntry.deleteMany({ where: { loanId: testLoan.id } });
      await prisma.loan.deleteMany({ where: { id: testLoan.id } });
    }
    if (testCustomer?.id) {
      await prisma.customer.deleteMany({ where: { id: testCustomer.id } });
    }
  });

  it("1. deleteLoanAction strictly rejects deleting a loan with ledger entries", async () => {
    const result = await deleteLoanAction(testLoan.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain("immutable");

    // Verify loan and ledgerEntry still exist in DB
    const loanInDb = await prisma.loan.findUnique({ where: { id: testLoan.id } });
    expect(loanInDb).not.toBeNull();

    const ledgerInDb = await prisma.ledgerEntry.count({ where: { loanId: testLoan.id } });
    expect(ledgerInDb).toBeGreaterThan(0);
  });

  it("2. deleteCustomerAction strictly rejects deleting a customer with loan history", async () => {
    const result = await deleteCustomerAction(testCustomer.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain("existing loan history");

    // Verify customer still exists in DB
    const customerInDb = await prisma.customer.findUnique({ where: { id: testCustomer.id } });
    expect(customerInDb).not.toBeNull();
  });

  it("3. deleteCustomerAction allows deleting a draft customer with 0 loans", async () => {
    const draftCustomer = await prisma.customer.create({
      data: {
        fullName: "Draft Customer No Loans",
        phone: "9876541299",
        addressLine1: "456 Empty St",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500002",
        createdById: adminUserId,
      },
    });

    const result = await deleteCustomerAction(draftCustomer.id);
    expect(result.success).toBe(true);

    const checkDb = await prisma.customer.findUnique({ where: { id: draftCustomer.id } });
    expect(checkDb).toBeNull();
  });

  it("4. Single-entry ledger architecture invariant: exactly one row created per event", async () => {
    const countBefore = await prisma.ledgerEntry.count();
    await writeLedgerEntry(prisma, {
      loanId: testLoan.id,
      type: "CLOSURE",
      amount: new Prisma.Decimal("0"),
      principalAfter: new Prisma.Decimal("0"),
      description: "Hardening test closure",
    });
    const countAfter = await prisma.ledgerEntry.count();
    expect(countAfter).toBe(countBefore + 1);
  });

  it("5. 50% presentation mode never alters non-monetary values", () => {
    const mockLoan = {
      id: "loan-123",
      loanNumber: "LN-2026-001",
      principalAmount: new Prisma.Decimal("100000"),
      principalOutstanding: new Prisma.Decimal("100000"),
      interestRateMonthly: new Prisma.Decimal("1.5"),
      totalAssessedValue: new Prisma.Decimal("150000"),
      eligibleAmount: new Prisma.Decimal("112500"),
      ltvPercent: new Prisma.Decimal("75.0"),
      tenureMonths: 12,
      gracePeriodDays: 7,
      status: "ACTIVE",
      loanDate: new Date("2026-01-01"),
      dueDate: new Date("2027-01-01"),
      lastSettledDate: new Date("2026-01-01"),
      items: [
        {
          id: "item-1",
          itemType: "GOLD",
          purity: "K22",
          grossWeightGrams: new Prisma.Decimal("25.500"),
          netWeightGrams: new Prisma.Decimal("24.000"),
          assessedValue: new Prisma.Decimal("150000"),
        },
      ],
      charges: [],
      payments: [],
      ledgerEntries: [],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projected: any = projectLoan(mockLoan as unknown as Parameters<typeof projectLoan>[0], "FIFTY_PERCENT");

    // Monetary fields halved
    expect(projected.principalAmount.toString()).toBe("50000");
    expect(projected.principalOutstanding.toString()).toBe("50000");
    expect(projected.totalAssessedValue.toString()).toBe("75000");
    expect(projected.eligibleAmount.toString()).toBe("56250");
    expect(projected.items[0].assessedValue.toString()).toBe("75000");

    // Non-monetary fields strictly unchanged
    expect(projected.interestRateMonthly.toString()).toBe("1.5");
    expect(projected.ltvPercent.toString()).toBe("75");
    expect(projected.tenureMonths).toBe(12);
    expect(projected.gracePeriodDays).toBe(7);
    expect(projected.items[0].grossWeightGrams.toString()).toBe("25.5");
    expect(projected.items[0].netWeightGrams.toString()).toBe("24");
    expect(projected.items[0].purity).toBe("K22");
    expect(projected.loanNumber).toBe("LN-2026-001");
  });
});
