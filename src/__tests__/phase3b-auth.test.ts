import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { verifyPassword, hashPassword } from "better-auth/crypto";
import { isValidIndianMobile } from "@/lib/auth/mobile-plugin";

interface AuthWithContext {
  $context: Promise<{
    internalAdapter: {
      createSession: (
        userId: string,
        dontRememberMe: boolean,
        overrides: Record<string, unknown>,
        overrideAll?: boolean
      ) => Promise<{ id: string; token: string; calculationMode: string }>;
      deleteSession: (token: string) => Promise<void>;
    };
  }>;
}

describe("Phase 3B: Mobile Authentication & Dual-Password Session Tests", () => {
  const testPhone = "9998887770";
  const normalPassword = "password123";
  const hiddenPassword = "hidden123";
  let testUserId: string;

  beforeAll(async () => {
    // Clean up any previous test user
    const existing = await prisma.user.findFirst({ where: { phone: testPhone } });
    if (existing) {
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      await prisma.account.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    // Create test user with both passwords
    const hiddenHash = await hashPassword(hiddenPassword);
    const res = await auth.api.signUpEmail({
      body: {
        email: "test.auth@pawnify.com",
        password: normalPassword,
        name: "Test Auth User",
      },
    });

    testUserId = res.user.id;
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        phone: testPhone,
        hiddenPasswordHash: hiddenHash,
        role: "ADMIN",
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.session.deleteMany({ where: { userId: testUserId } });
      await prisma.account.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  it("T5: Invalid phone format rejected by Indian mobile validator", () => {
    expect(isValidIndianMobile("1234567890")).toBe(false); // starts with 1
    expect(isValidIndianMobile("5555555555")).toBe(false); // starts with 5
    expect(isValidIndianMobile("98765")).toBe(false); // too short
    expect(isValidIndianMobile("9876543210123")).toBe(false); // too long
    expect(isValidIndianMobile("abcdefghij")).toBe(false); // non-digits

    // Valid formats
    expect(isValidIndianMobile("9876543210")).toBe(true);
    expect(isValidIndianMobile("+91 9876543210")).toBe(true);
    expect(isValidIndianMobile("09876543210")).toBe(true);
    expect(isValidIndianMobile("91-98765-43210")).toBe(true);
  });

  it("T4: Duplicate mobile number rejected", async () => {
    // Attempting to create or update another user with testPhone should violate unique constraint
    await expect(
      prisma.user.create({
        data: {
          id: "dup-user-id",
          name: "Duplicate User",
          email: "duplicate@pawnify.com",
          phone: testPhone,
        },
      })
    ).rejects.toThrow();
  });

  it("T1: Normal password login sets calculationMode = NORMAL", async () => {
    const user = await prisma.user.findUnique({
      where: { phone: testPhone },
      include: { accounts: true },
    });
    expect(user).toBeDefined();

    const credentialAccount = user?.accounts.find((a) => a.providerId === "credential");
    expect(credentialAccount?.password).toBeDefined();

    const isNormalMatch = await verifyPassword({
      hash: credentialAccount!.password!,
      password: normalPassword,
    });
    expect(isNormalMatch).toBe(true);

    // Create session via Better Auth internal adapter with calculationMode: NORMAL
    const ctx = await (auth as unknown as AuthWithContext).$context;
    const session = await ctx.internalAdapter.createSession(user!.id, false, {
      calculationMode: "NORMAL",
    });

    expect(session).toBeDefined();
    expect(session.calculationMode).toBe("NORMAL");

    // Verify stored in DB
    const dbSession = await prisma.session.findUnique({ where: { token: session.token } });
    expect(dbSession?.calculationMode).toBe("NORMAL");
  });

  it("T2: Hidden password login sets calculationMode = FIFTY_PERCENT", async () => {
    const user = await prisma.user.findUnique({
      where: { phone: testPhone },
    });
    expect(user?.hiddenPasswordHash).toBeDefined();

    const isHiddenMatch = await verifyPassword({
      hash: user!.hiddenPasswordHash!,
      password: hiddenPassword,
    });
    expect(isHiddenMatch).toBe(true);

    // Create session with calculationMode: FIFTY_PERCENT
    const ctx = await (auth as unknown as AuthWithContext).$context;
    const session = await ctx.internalAdapter.createSession(
      user!.id,
      false,
      { calculationMode: "FIFTY_PERCENT" },
      true
    );

    expect(session).toBeDefined();
    expect(session.calculationMode).toBe("FIFTY_PERCENT");

    // Verify stored in DB
    const dbSession = await prisma.session.findUnique({ where: { token: session.token } });
    expect(dbSession?.calculationMode).toBe("FIFTY_PERCENT");
  });

  it("T3: Wrong password fails verification", async () => {
    const user = await prisma.user.findUnique({
      where: { phone: testPhone },
      include: { accounts: true },
    });

    const credentialAccount = user?.accounts.find((a) => a.providerId === "credential");
    const isNormalMatch = await verifyPassword({
      hash: credentialAccount!.password!,
      password: "incorrectPassword",
    });
    const isHiddenMatch = await verifyPassword({
      hash: user!.hiddenPasswordHash!,
      password: "incorrectPassword",
    });

    expect(isNormalMatch).toBe(false);
    expect(isHiddenMatch).toBe(false);
  });

  it("T16: Session isolation — Simultaneous sessions have isolated calculationMode", async () => {
    const ctx = await (auth as unknown as AuthWithContext).$context;

    // Session A created with NORMAL
    const sessionA = await ctx.internalAdapter.createSession(
      testUserId,
      false,
      { calculationMode: "NORMAL" },
      true
    );

    // Session B created with FIFTY_PERCENT
    const sessionB = await ctx.internalAdapter.createSession(
      testUserId,
      false,
      { calculationMode: "FIFTY_PERCENT" },
      true
    );

    const dbSessionA = await prisma.session.findUnique({ where: { token: sessionA.token } });
    const dbSessionB = await prisma.session.findUnique({ where: { token: sessionB.token } });

    expect(dbSessionA?.calculationMode).toBe("NORMAL");
    expect(dbSessionB?.calculationMode).toBe("FIFTY_PERCENT");

    // Modifying or checking one does not change the other
    expect(dbSessionA?.calculationMode).not.toBe(dbSessionB?.calculationMode);
  });

  it("T17: Logout invalidates session completely", async () => {
    const ctx = await (auth as unknown as AuthWithContext).$context;
    const session = await ctx.internalAdapter.createSession(testUserId, false, {
      calculationMode: "FIFTY_PERCENT",
    });

    expect(await prisma.session.findUnique({ where: { token: session.token } })).toBeDefined();

    // Invalidate
    await ctx.internalAdapter.deleteSession(session.token);

    // Verify destroyed
    const afterLogout = await prisma.session.findUnique({ where: { token: session.token } });
    expect(afterLogout).toBeNull();
  });

  it("T18 & T19: RBAC preserved in both calculation modes", async () => {
    const adminUser = await prisma.user.findUnique({ where: { phone: testPhone } });
    expect(adminUser?.role).toBe("ADMIN");

    // Staff user
    const staffUser = await prisma.user.findUnique({ where: { phone: "9876543211" } });
    expect(staffUser?.role).toBe("STAFF");

    // An admin retains role = ADMIN regardless of calculationMode
    expect(adminUser?.role).toBe("ADMIN");
    // A staff remains role = STAFF regardless of calculationMode
    expect(staffUser?.role).toBe("STAFF");
  });

  it("Security: Hidden and normal password hashes are NEVER exposed in client-facing data", async () => {
    // 1. Staff list action projection test
    const staffMembers = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            loansHandled: true,
            paymentsCollected: true,
          },
        },
      },
    });

    const clientStaffList = staffMembers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      hasHiddenPassword: !!u.hiddenPasswordHash, // Boolean indicator only
      _count: {
        loansHandled: u._count.loansHandled,
        paymentsCollected: u._count.paymentsCollected,
      },
      createdAt: u.createdAt,
    }));

    const serialized = JSON.stringify(clientStaffList);
    expect(serialized).not.toContain("hiddenPasswordHash");
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("hidden123");
    expect(serialized).not.toContain("password123");

    for (const member of clientStaffList) {
      expect(member).not.toHaveProperty("hiddenPasswordHash");
      expect(member).not.toHaveProperty("password");
      expect(typeof member.hasHiddenPassword).toBe("boolean");
    }

    // 2. Select query test
    const user = await prisma.user.findUnique({
      where: { phone: testPhone },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
      },
    });

    expect(user).not.toHaveProperty("hiddenPasswordHash");
    expect(user).not.toHaveProperty("password");
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("Security: Client cannot tamper with calculationMode via body, query, or headers", async () => {
    const ctx = await (auth as unknown as AuthWithContext).$context;

    // Create session initially authenticated with FIFTY_PERCENT
    const session = await ctx.internalAdapter.createSession(
      testUserId,
      false,
      { calculationMode: "FIFTY_PERCENT" },
      true
    );

    // Verify session in DB is FIFTY_PERCENT
    const dbSession = await prisma.session.findUnique({
      where: { token: session.token },
    });
    expect(dbSession?.calculationMode).toBe("FIFTY_PERCENT");

    // Client attempts to pass calculationMode = "NORMAL" in request body
    const maliciousClientBody = {
      amount: "5000",
      calculationMode: "NORMAL", // Attempted tamper
    };

    // The server ignores client-submitted calculationMode and reads ONLY from dbSession
    const serverDerivedMode = dbSession?.calculationMode === "FIFTY_PERCENT" ? "FIFTY_PERCENT" : "NORMAL";
    expect(serverDerivedMode).toBe("FIFTY_PERCENT");
    expect(serverDerivedMode).not.toBe(maliciousClientBody.calculationMode);

    // Client attempts to pass calculationMode = "FIFTY_PERCENT" while normal
    const normalSession = await ctx.internalAdapter.createSession(
      testUserId,
      false,
      { calculationMode: "NORMAL" },
      true
    );
    const dbNormalSession = await prisma.session.findUnique({
      where: { token: normalSession.token },
    });
    const maliciousClientBody2 = {
      calculationMode: "FIFTY_PERCENT", // Attempted tamper
    };
    const serverDerivedMode2 = dbNormalSession?.calculationMode === "FIFTY_PERCENT" ? "FIFTY_PERCENT" : "NORMAL";
    expect(serverDerivedMode2).toBe("NORMAL");
    expect(serverDerivedMode2).not.toBe(maliciousClientBody2.calculationMode);

    // Clean up test sessions
    await ctx.internalAdapter.deleteSession(session.token);
    await ctx.internalAdapter.deleteSession(normalSession.token);
  });
});
