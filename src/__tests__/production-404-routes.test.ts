import { describe, it, expect, vi } from "vitest";
import { getLoanById } from "@/lib/services/loans";
import { getCustomerById, searchCustomers } from "@/lib/services/customers";
import { getDashboardStats } from "@/lib/services/dashboard";
import nextConfig from "../../next.config";
import { prisma } from "@/lib/db";
import Decimal from "decimal.js";

describe("Production 404 & Routing Resilience Tests", () => {
  describe("1. Next.js Route Redirects", () => {
    it("should define redirects for convenience paths preventing 404s", async () => {
      const redirects = typeof nextConfig.redirects === "function" ? await nextConfig.redirects() : [];
      const sources = redirects.map((r) => r.source);

      expect(sources).toContain("/accounts");
      expect(sources).toContain("/daybook");
      expect(sources).toContain("/ledger");
      expect(sources).toContain("/staff");
      expect(sources).toContain("/settings");

      const daybookRedirect = redirects.find((r) => r.source === "/daybook");
      expect(daybookRedirect?.destination).toBe("/day-book");

      const ledgerRedirect = redirects.find((r) => r.source === "/ledger");
      expect(ledgerRedirect?.destination).toBe("/account-ledger");
    });
  });

  describe("2. Loan Lookup by ID & Loan Number (Dual Resolution)", () => {
    it("should safely return null for empty, undefined, or null string IDs", async () => {
      expect(await getLoanById("")).toBeNull();
      expect(await getLoanById("undefined")).toBeNull();
      expect(await getLoanById("null")).toBeNull();
    });

    it("should query by both id and loanNumber so neither 404s", async () => {
      const mockLoan = {
        id: "cuid-12345",
        loanNumber: "PL-2026-000001",
        customerId: "cust-1",
        loanDate: new Date(),
        dueDate: new Date(),
        gracePeriodDays: 7,
        principalAmount: new Decimal("50000"),
        principalOutstanding: new Decimal("50000"),
        interestRateMonthly: new Decimal("1.5"),
        interestType: "STANDARD",
        interestFrequency: "MONTHLY",
        cumulativePeriodMonths: null,
        interestTreatment: null,
        interestOutstanding: new Decimal("0"),
        lastCapitalizedAt: null,
        lastSettledDate: new Date(),
        status: "ACTIVE",
        totalAssessedValue: new Decimal("70000"),
        ltvPercent: new Decimal("71.4"),
        storageLocation: "Vault A",
        packetNumber: "PK-1",
        notes: null,
        handledById: "staff-1",
        closedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        customer: { id: "cust-1", fullName: "Test Customer", phone: "9876543210" },
        handledBy: { id: "staff-1", name: "Staff", email: "staff@pawnify.com" },
      };

      const findFirstSpy = vi
        .spyOn(prisma.loan, "findFirst")
        .mockResolvedValueOnce(mockLoan as unknown as Awaited<ReturnType<typeof prisma.loan.findFirst>>);

      vi.spyOn(prisma.loanItem, "findMany").mockResolvedValueOnce([]);
      vi.spyOn(prisma.payment, "findMany").mockResolvedValueOnce([]);
      vi.spyOn(prisma.loanCharge, "findMany").mockResolvedValueOnce([]);
      vi.spyOn(prisma.ledgerEntry, "findMany").mockResolvedValueOnce([]);
      vi.spyOn(prisma.followUp, "findMany").mockResolvedValueOnce([]);

      const result = await getLoanById("PL-2026-000001");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("cuid-12345");
      expect(result?.loanNumber).toBe("PL-2026-000001");
      expect(findFirstSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ id: "PL-2026-000001" }, { loanNumber: "PL-2026-000001" }],
          },
        })
      );
    });
  });

  describe("3. Customer Dual Resolution & Search by ID", () => {
    it("should safely return null for invalid customer IDs", async () => {
      expect(await getCustomerById("")).toBeNull();
      expect(await getCustomerById("undefined")).toBeNull();
      expect(await getCustomerById("null")).toBeNull();
    });

    it("should query customer by OR: [{ id }, { phone }]", async () => {
      const mockCustomer = {
        id: "cust-cuid",
        fullName: "Ramesh Patel",
        phone: "9845099881",
        email: "ramesh@example.com",
        dob: null,
        addressLine1: "42 Station Rd",
        addressLine2: null,
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600001",
        photoUrl: null,
        createdById: "staff-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        kycDocuments: [],
        createdBy: { id: "staff-1", name: "Staff" },
        loans: [],
      };

      const findFirstSpy = vi
        .spyOn(prisma.customer, "findFirst")
        .mockResolvedValueOnce(mockCustomer as unknown as Awaited<ReturnType<typeof prisma.customer.findFirst>>);

      const customer = await getCustomerById("9845099881");
      expect(customer).not.toBeNull();
      expect(customer?.fullName).toBe("Ramesh Patel");
      expect(findFirstSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ id: "9845099881" }, { phone: "9845099881" }],
          },
        })
      );
    });

    it("should support customer search by id for initial selection in loan creation", async () => {
      const mockSearchResults = [
        {
          id: "cust-cuid-99",
          fullName: "Suresh Babu",
          phone: "9845010004",
          city: "Madurai",
        },
      ];

      const findManySpy = vi
        .spyOn(prisma.customer, "findMany")
        .mockResolvedValueOnce(mockSearchResults as unknown as Awaited<ReturnType<typeof prisma.customer.findMany>>);

      const results = await searchCustomers("cust-cuid-99");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("cust-cuid-99");
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { id: "cust-cuid-99" },
              { fullName: { contains: "cust-cuid-99", mode: "insensitive" } },
              { phone: { contains: "cust-cuid-99" } },
            ],
          },
        })
      );
    });
  });

  describe("4. Dashboard Recent Activity Loan ID Link Preservation", () => {
    it("should select loan.id and map loanId into recentActivity items", async () => {
      // Mock minimal dashboard dependencies
      vi.spyOn(prisma.loan, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.loan, "count").mockResolvedValue(0);
      vi.spyOn(prisma.customer, "count").mockResolvedValue(0);
      vi.spyOn(prisma.loan, "aggregate").mockResolvedValue({
        _sum: { principalAmount: new Decimal(0) },
        _count: 0,
      } as unknown as Awaited<ReturnType<typeof prisma.loan.aggregate>>);
      vi.spyOn(prisma.payment, "aggregate").mockResolvedValue({
        _sum: {
          amountPaid: new Decimal(0),
          allocatedPrincipal: new Decimal(0),
          allocatedInterest: new Decimal(0),
          allocatedCharges: new Decimal(0),
        },
        _count: 0,
      } as unknown as Awaited<ReturnType<typeof prisma.payment.aggregate>>);
      vi.spyOn(prisma.followUp, "count").mockResolvedValue(0);
      vi.spyOn(prisma.appSetting, "findUnique").mockResolvedValue(null);

      const mockEntries = [
        {
          id: "entry-1",
          loanId: "cuid-loan-1",
          createdAt: new Date(),
          type: "DISBURSEMENT",
          amount: new Decimal("25000"),
          principalAfter: new Decimal("25000"),
          accountId: "acc-1",
          referenceId: "REF-1",
          description: "Gold loan disbursed",
          loan: {
            id: "cuid-loan-1",
            loanNumber: "PL-2026-000002",
            customer: { id: "cust-1", fullName: "Anita", phone: "9845010003" },
          },
          account: { id: "acc-1", code: "CASH-01", name: "Counter Cash", type: "ASSET" },
        },
      ];

      vi.spyOn(prisma.ledgerEntry, "findMany").mockResolvedValueOnce(
        mockEntries as unknown as Awaited<ReturnType<typeof prisma.ledgerEntry.findMany>>
      );

      const stats = await getDashboardStats();
      expect(stats.recentActivity).toHaveLength(1);
      expect(stats.recentActivity[0].loanId).toBe("cuid-loan-1");
      expect(stats.recentActivity[0].loanNumber).toBe("PL-2026-000002");
    });
  });
});
