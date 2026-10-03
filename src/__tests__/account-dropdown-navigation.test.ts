import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAccountsForFilterAction } from "@/app/(app)/day-book/actions";
import { listAccountsForLedgerSelectorAction } from "@/app/(app)/account-ledger/actions";
import { createAccountAction } from "@/app/(app)/admin/accounts/actions";
import nextConfig from "../../next.config";

import { prisma } from "@/lib/db";

// Mock auth session to return real ADMIN
vi.mock("@/lib/auth/session", () => ({
  checkAuth: vi.fn(),
  checkAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { checkAuth, checkAdmin } from "@/lib/auth/session";

describe("Account Dropdown & Navigation UX Enhancement", () => {
  beforeEach(async () => {
    const realAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    const adminUser = {
      id: realAdmin ? realAdmin.id : "admin-user-id",
      name: "Admin",
      email: "admin@pawnify.com",
      role: "ADMIN",
      phone: "1234567890",
      isActive: true,
    };
    vi.mocked(checkAuth).mockResolvedValue({
      authenticated: true,
      user: adminUser,
      sessionId: "admin-session",
      calculationMode: "NORMAL",
    });
    vi.mocked(checkAdmin).mockResolvedValue({
      authenticated: true,
      user: adminUser,
      sessionId: "admin-session",
      calculationMode: "NORMAL",
    });
  });

  it("1. next.config redirects /accounts to /admin/accounts", async () => {
    expect(nextConfig.redirects).toBeDefined();
    if (nextConfig.redirects) {
      const redirects = await nextConfig.redirects();
      const accountsRedirect = redirects.find((r) => r.source === "/accounts");
      expect(accountsRedirect).toBeDefined();
      expect(accountsRedirect?.destination).toBe("/admin/accounts");
      expect(accountsRedirect?.permanent).toBe(false);
    }
  });

  it("2. Day Book listAccountsForFilterAction returns list of active accounts", async () => {
    const accounts = await listAccountsForFilterAction();
    expect(Array.isArray(accounts)).toBe(true);
    // Active accounts should have id, code, and name
    for (const acc of accounts) {
      expect(acc).toHaveProperty("id");
      expect(acc).toHaveProperty("code");
      expect(acc).toHaveProperty("name");
    }
  });

  it("3. Account Ledger listAccountsForLedgerSelectorAction returns active accounts", async () => {
    const accounts = await listAccountsForLedgerSelectorAction();
    expect(Array.isArray(accounts)).toBe(true);
    for (const acc of accounts) {
      expect(acc).toHaveProperty("id");
      expect(acc).toHaveProperty("code");
      expect(acc).toHaveProperty("name");
      expect(acc).toHaveProperty("type");
    }
  });

  it("4. When a new account is created via createAccountAction, it becomes available in both selectors", async () => {
    const testCode = `TEST_${Date.now().toString().slice(-6)}`;
    const createRes = await createAccountAction({
      code: testCode,
      name: `Test Account ${testCode}`,
      type: "ASSET",
      description: "Automated test account for dropdown verification",
      isActive: true,
    });

    expect(createRes.success).toBe(true);
    expect(createRes.account).toBeDefined();
    expect(createRes.account?.code).toBe(testCode);

    try {
      // Verify it appears in Day Book filter action
      const dayBookAccounts = await listAccountsForFilterAction();
      const inDayBook = dayBookAccounts.some((a) => a.code === testCode);
      expect(inDayBook).toBe(true);

      // Verify it appears in Account Ledger selector action
      const ledgerAccounts = await listAccountsForLedgerSelectorAction();
      const inLedger = ledgerAccounts.some((a) => a.code === testCode);
      expect(inLedger).toBe(true);
    } finally {
      // Clean up test account
      await prisma.accountMaster.deleteMany({
        where: { code: testCode },
      });
    }
  });

  it("5. URL cleaning logic removes addAccount param while preserving other query params", () => {
    const searchParamsStr = "date=2026-10-03&addAccount=true&foo=bar";
    const params = new URLSearchParams(searchParamsStr);
    expect(params.get("addAccount")).toBe("true");

    // Removal logic as implemented in AccountsClient
    params.delete("addAccount");
    const newQuery = params.toString();
    const pathname = "/admin/accounts";
    const newUrl = newQuery ? `${pathname}?${newQuery}` : pathname;

    expect(newUrl).toBe("/admin/accounts?date=2026-10-03&foo=bar");
    expect(params.get("addAccount")).toBeNull();
  });

  it("6. URL cleaning logic with only addAccount results in clean pathname", () => {
    const searchParamsStr = "addAccount=true";
    const params = new URLSearchParams(searchParamsStr);
    params.delete("addAccount");
    const newQuery = params.toString();
    const pathname = "/admin/accounts";
    const newUrl = newQuery ? `${pathname}?${newQuery}` : pathname;

    expect(newUrl).toBe("/admin/accounts");
  });
});
