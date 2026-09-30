/**
 * Seed Script — Comprehensive demo data per §11
 *
 * Creates:
 * - 1 admin + 2 staff users (via Better Auth signUp)
 * - 6-8 demo customers with KYC documents
 * - 12-15 loans: active, overdue (backdated), closed with released items
 * - Payment history showing waterfall allocations
 * - Follow-up tasks
 * - AppSetting defaults
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { addMonths, subDays, subMonths } from "date-fns";
import "dotenv/config";
import { auth } from "../src/lib/auth";
import { hashPassword } from "better-auth/crypto";

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// ==================== Helpers ====================

function loanNumber(n: number): string {
  return `PL-2026-${String(n).padStart(6, "0")}`;
}

function receiptNumber(n: number): string {
  return `REC-20260706-${String(n).padStart(5, "0")}`;
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    console.error("❌ Refusing to run destructive development seed script in production!");
    console.error("   To bootstrap an initial admin user safely, use: npx tsx scripts/bootstrap-admin.ts");
    process.exit(1);
  }

  console.log("🌱 Seeding Pawnify database...\n");

  // Clean existing data (order matters due to FKs)
  await prisma.ledgerEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.loanCharge.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.loanItem.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.kycDocument.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appSetting.deleteMany();

  // ==================== App Settings ====================
  console.log("📋 Creating app settings...");

  const settingsData = [
    { key: "ltv.tier1.max", value: "250000" },
    { key: "ltv.tier1.percent", value: "85" },
    { key: "ltv.tier2.max", value: "500000" },
    { key: "ltv.tier2.percent", value: "80" },
    { key: "ltv.tier3.percent", value: "75" },
    { key: "interest.default.monthly", value: "1.500" },
    { key: "grace.period.days", value: "7" },
    { key: "pan.threshold", value: "50000" },
  ];

  for (const s of settingsData) {
    await prisma.appSetting.create({ data: s });
  }

  // ==================== Users ====================
  console.log("👤 Creating users...");

  // Development-only seed credentials:
  // Normal password: password123 (Mode: NORMAL)
  // Hidden password: hidden123 (Mode: FIFTY_PERCENT)
  const devHiddenPasswordHash = await hashPassword("hidden123");

  const resAdmin = await auth.api.signUpEmail({
    body: {
      email: "admin@pawnify.com",
      password: "password123",
      name: "Rajesh Kumar",
      phone: "9876543210",
    },
  });
  const adminId = resAdmin.user.id;
  await prisma.user.update({
    where: { id: adminId },
    data: {
      role: "ADMIN",
      emailVerified: true,
      isActive: true,
      phone: "9876543210",
      hiddenPasswordHash: devHiddenPasswordHash,
    },
  });

  const resStaff1 = await auth.api.signUpEmail({
    body: {
      email: "priya@pawnify.com",
      password: "password123",
      name: "Priya Sharma",
      phone: "9876543211",
    },
  });
  const staff1Id = resStaff1.user.id;
  await prisma.user.update({
    where: { id: staff1Id },
    data: {
      role: "STAFF",
      emailVerified: true,
      isActive: true,
      phone: "9876543211",
      hiddenPasswordHash: devHiddenPasswordHash,
    },
  });

  const resStaff2 = await auth.api.signUpEmail({
    body: {
      email: "amit@pawnify.com",
      password: "password123",
      name: "Amit Patel",
      phone: "9876543212",
    },
  });
  const staff2Id = resStaff2.user.id;
  await prisma.user.update({
    where: { id: staff2Id },
    data: {
      role: "STAFF",
      emailVerified: true,
      isActive: true,
      phone: "9876543212",
      hiddenPasswordHash: devHiddenPasswordHash,
    },
  });

  console.log(`  ✅ Admin: 9876543210 / admin@pawnify.com`);
  console.log(`  ✅ Staff: 9876543211 / priya@pawnify.com`);
  console.log(`  ✅ Staff: 9876543212 / amit@pawnify.com`);

  // ==================== Customers ====================
  console.log("\n👥 Creating customers...");

  const customersData = [
    {
      fullName: "Lakshmi Devi",
      phone: "9845012345",
      email: "lakshmi.d@email.com",
      addressLine1: "12, Gandhi Nagar",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600001",
      kyc: [
        { docType: "AADHAAR" as const, docNumber: "234567891234", status: "VERIFIED" as const },
        { docType: "PAN" as const, docNumber: "ABCDE1234F", status: "VERIFIED" as const },
      ],
    },
    {
      fullName: "Mohammed Farooq",
      phone: "9845012346",
      email: "farooq.m@email.com",
      addressLine1: "45, Jubilee Hills",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500033",
      kyc: [
        { docType: "AADHAAR" as const, docNumber: "345678912345", status: "VERIFIED" as const },
      ],
    },
    {
      fullName: "Anita Verma",
      phone: "9845012347",
      email: "anita.v@email.com",
      addressLine1: "78, MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      kyc: [
        { docType: "PAN" as const, docNumber: "FGHIJ5678K", status: "VERIFIED" as const },
        { docType: "VOTER_ID" as const, docNumber: "XYZ1234567", status: "PENDING" as const },
      ],
    },
    {
      fullName: "Suresh Babu",
      phone: "9845012348",
      addressLine1: "23, Anna Salai",
      city: "Madurai",
      state: "Tamil Nadu",
      pincode: "625001",
      kyc: [
        { docType: "AADHAAR" as const, docNumber: "456789123456", status: "VERIFIED" as const },
      ],
    },
    {
      fullName: "Rekha Menon",
      phone: "9845012349",
      email: "rekha.m@email.com",
      addressLine1: "56, Park Street",
      city: "Kolkata",
      state: "West Bengal",
      pincode: "700016",
      kyc: [
        { docType: "AADHAAR" as const, docNumber: "567891234567", status: "VERIFIED" as const },
        { docType: "PAN" as const, docNumber: "LMNOP6789Q", status: "VERIFIED" as const },
      ],
    },
    {
      fullName: "Ravi Shankar",
      phone: "9845012350",
      addressLine1: "89, Civil Lines",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
      kyc: [{ docType: "AADHAAR" as const, docNumber: "678912345678", status: "PENDING" as const }],
    },
    {
      fullName: "Deepa Krishnan",
      phone: "9845012351",
      email: "deepa.k@email.com",
      addressLine1: "34, Cathedral Road",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600086",
      kyc: [
        { docType: "PAN" as const, docNumber: "RSTUV7890W", status: "VERIFIED" as const },
        { docType: "PASSPORT" as const, docNumber: "A1234567", status: "VERIFIED" as const },
      ],
    },
    {
      fullName: "Vijay Mallya",
      phone: "9845012352",
      addressLine1: "67, Bandra West",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400050",
      kyc: [
        { docType: "AADHAAR" as const, docNumber: "789123456789", status: "REJECTED" as const },
      ],
    },
  ];

  const customers: Array<{ id: string; fullName: string }> = [];

  for (const c of customersData) {
    const customer = await prisma.customer.create({
      data: {
        fullName: c.fullName,
        phone: c.phone,
        email: c.email || null,
        addressLine1: c.addressLine1,
        city: c.city,
        state: c.state,
        pincode: c.pincode,
        createdById: [adminId, staff1Id, staff2Id][Math.floor(Math.random() * 3)],
        kycDocuments: {
          create: c.kyc.map((k) => ({
            docType: k.docType,
            docNumber: k.docNumber,
            status: k.status,
            verifiedById: k.status !== "PENDING" ? adminId : null,
          })),
        },
      },
    });
    customers.push({ id: customer.id, fullName: customer.fullName });
    console.log(`  ✅ ${customer.fullName} (${c.phone})`);
  }

  // ==================== Loans ====================
  console.log("\n💰 Creating loans...");

  const now = new Date();

  interface LoanSeed {
    customerIdx: number;
    staffId: string;
    items: Array<{
      metalType: "GOLD" | "SILVER";
      description: string;
      purityLabel: string;
      purityPercent: number;
      grossWeight: number;
      stoneWeight: number;
      rate: number;
      packetNumber: string;
      storageLocation: string;
    }>;
    tenureMonths: number;
    interestRate: number;
    principalPercent: number; // of eligible
    loanDate: Date;
    status: "ACTIVE" | "CLOSED";
    payments: Array<{
      amount: number;
      daysSinceLoan: number;
      mode: "CASH" | "UPI" | "BANK_TRANSFER";
    }>;
    processingFee?: number;
  }

  const loansData: LoanSeed[] = [
    // 1. Active, current — Lakshmi, 22K gold chain
    {
      customerIdx: 0,
      staffId: staff1Id,
      items: [
        {
          metalType: "GOLD",
          description: "22K Gold Chain",
          purityLabel: "22K",
          purityPercent: 91.6,
          grossWeight: 25.5,
          stoneWeight: 0,
          rate: 7500,
          packetNumber: "PKT-001",
          storageLocation: "Vault A / Rack 1 / Shelf 1",
        },
      ],
      tenureMonths: 6,
      interestRate: 1.5,
      principalPercent: 95,
      loanDate: subDays(now, 30),
      status: "ACTIVE",
      payments: [{ amount: 2500, daysSinceLoan: 15, mode: "CASH" }],
      processingFee: 500,
    },
    // 2. Active, current — Farooq, mixed items
    {
      customerIdx: 1,
      staffId: staff2Id,
      items: [
        {
          metalType: "GOLD",
          description: "22K Gold Bangles (pair)",
          purityLabel: "22K",
          purityPercent: 91.6,
          grossWeight: 40.0,
          stoneWeight: 1.2,
          rate: 7500,
          packetNumber: "PKT-002",
          storageLocation: "Vault A / Rack 1 / Shelf 2",
        },
        {
          metalType: "GOLD",
          description: "18K Gold Ring with Stone",
          purityLabel: "18K",
          purityPercent: 75.0,
          grossWeight: 8.5,
          stoneWeight: 2.0,
          rate: 7500,
          packetNumber: "PKT-003",
          storageLocation: "Vault A / Rack 1 / Shelf 3",
        },
      ],
      tenureMonths: 6,
      interestRate: 1.5,
      principalPercent: 90,
      loanDate: subDays(now, 45),
      status: "ACTIVE",
      payments: [{ amount: 5000, daysSinceLoan: 30, mode: "UPI" }],
    },
    // 3. Active, OVERDUE — Anita, 3 months past due
    {
      customerIdx: 2,
      staffId: staff1Id,
      items: [
        {
          metalType: "GOLD",
          description: "24K Gold Coin (10g)",
          purityLabel: "24K",
          purityPercent: 99.9,
          grossWeight: 10.0,
          stoneWeight: 0,
          rate: 7800,
          packetNumber: "PKT-004",
          storageLocation: "Vault A / Rack 2 / Shelf 1",
        },
      ],
      tenureMonths: 3,
      interestRate: 1.5,
      principalPercent: 85,
      loanDate: subMonths(now, 6),
      status: "ACTIVE",
      payments: [
        { amount: 1000, daysSinceLoan: 30, mode: "CASH" },
        { amount: 1000, daysSinceLoan: 60, mode: "CASH" },
      ],
    },
    // 4. Active, OVERDUE — Suresh, silver items
    {
      customerIdx: 3,
      staffId: staff2Id,
      items: [
        {
          metalType: "SILVER",
          description: "Sterling Silver Anklet Pair",
          purityLabel: "Sterling Silver",
          purityPercent: 92.5,
          grossWeight: 150.0,
          stoneWeight: 0,
          rate: 95,
          packetNumber: "PKT-005",
          storageLocation: "Vault B / Rack 1 / Shelf 1",
        },
        {
          metalType: "SILVER",
          description: "Fine Silver Bowl",
          purityLabel: "Fine Silver",
          purityPercent: 99.9,
          grossWeight: 200.0,
          stoneWeight: 0,
          rate: 95,
          packetNumber: "PKT-006",
          storageLocation: "Vault B / Rack 1 / Shelf 2",
        },
      ],
      tenureMonths: 6,
      interestRate: 1.8,
      principalPercent: 80,
      loanDate: subMonths(now, 8),
      status: "ACTIVE",
      payments: [],
    },
    // 5. CLOSED — Rekha, fully paid and released
    {
      customerIdx: 4,
      staffId: staff1Id,
      items: [
        {
          metalType: "GOLD",
          description: "22K Gold Necklace Set",
          purityLabel: "22K",
          purityPercent: 91.6,
          grossWeight: 35.0,
          stoneWeight: 0.5,
          rate: 7200,
          packetNumber: "PKT-007",
          storageLocation: "Vault A / Rack 2 / Shelf 2",
        },
      ],
      tenureMonths: 6,
      interestRate: 1.5,
      principalPercent: 85,
      loanDate: subMonths(now, 4),
      status: "CLOSED",
      payments: [], // Will handle closure separately
    },
    // 6. CLOSED — Ravi, fully paid, items released
    {
      customerIdx: 5,
      staffId: staff2Id,
      items: [
        {
          metalType: "GOLD",
          description: "22K Gold Bracelet",
          purityLabel: "22K",
          purityPercent: 91.6,
          grossWeight: 15.0,
          stoneWeight: 0,
          rate: 7300,
          packetNumber: "PKT-008",
          storageLocation: "Vault A / Rack 3 / Shelf 1",
        },
      ],
      tenureMonths: 3,
      interestRate: 1.5,
      principalPercent: 80,
      loanDate: subMonths(now, 5),
      status: "CLOSED",
      payments: [],
    },
    // 7. Active, recent — Deepa, high-value loan
    {
      customerIdx: 6,
      staffId: adminId,
      items: [
        {
          metalType: "GOLD",
          description: "22K Gold Temple Jewellery Set",
          purityLabel: "22K",
          purityPercent: 91.6,
          grossWeight: 80.0,
          stoneWeight: 3.0,
          rate: 7500,
          packetNumber: "PKT-009",
          storageLocation: "Vault A / Rack 3 / Shelf 2",
        },
        {
          metalType: "GOLD",
          description: "24K Gold Bar (50g)",
          purityLabel: "24K",
          purityPercent: 99.9,
          grossWeight: 50.0,
          stoneWeight: 0,
          rate: 7800,
          packetNumber: "PKT-010",
          storageLocation: "Vault A / Rack 3 / Shelf 3",
        },
      ],
      tenureMonths: 12,
      interestRate: 1.25,
      principalPercent: 90,
      loanDate: subDays(now, 10),
      status: "ACTIVE",
      payments: [],
      processingFee: 2000,
    },
    // 8. Active, current — Lakshmi (2nd loan)
    {
      customerIdx: 0,
      staffId: staff2Id,
      items: [
        {
          metalType: "GOLD",
          description: "22K Gold Earrings",
          purityLabel: "22K",
          purityPercent: 91.6,
          grossWeight: 12.0,
          stoneWeight: 0.8,
          rate: 7500,
          packetNumber: "PKT-011",
          storageLocation: "Vault A / Rack 4 / Shelf 1",
        },
      ],
      tenureMonths: 6,
      interestRate: 1.5,
      principalPercent: 85,
      loanDate: subDays(now, 5),
      status: "ACTIVE",
      payments: [],
    },
    // 9. Active, due soon — Farooq (2nd loan)
    {
      customerIdx: 1,
      staffId: staff1Id,
      items: [
        {
          metalType: "SILVER",
          description: "Fine Silver Plate Set",
          purityLabel: "Fine Silver",
          purityPercent: 99.9,
          grossWeight: 500.0,
          stoneWeight: 0,
          rate: 95,
          packetNumber: "PKT-012",
          storageLocation: "Vault B / Rack 2 / Shelf 1",
        },
      ],
      tenureMonths: 3,
      interestRate: 1.8,
      principalPercent: 80,
      loanDate:
        subMonths(now, 2).valueOf() > subDays(now, 85).valueOf()
          ? subMonths(now, 2)
          : subDays(now, 85),
      status: "ACTIVE",
      payments: [
        { amount: 700, daysSinceLoan: 30, mode: "UPI" },
        { amount: 700, daysSinceLoan: 60, mode: "UPI" },
      ],
    },
    // 10. Active, OVERDUE — Vijay
    {
      customerIdx: 7,
      staffId: staff1Id,
      items: [
        {
          metalType: "GOLD",
          description: "14K Gold Watch Band",
          purityLabel: "14K",
          purityPercent: 58.5,
          grossWeight: 30.0,
          stoneWeight: 5.0,
          rate: 7500,
          packetNumber: "PKT-013",
          storageLocation: "Vault A / Rack 4 / Shelf 2",
        },
      ],
      tenureMonths: 3,
      interestRate: 2.0,
      principalPercent: 75,
      loanDate: subMonths(now, 5),
      status: "ACTIVE",
      payments: [],
    },
    // 11. Active, current — Anita (2nd loan)
    {
      customerIdx: 2,
      staffId: staff2Id,
      items: [
        {
          metalType: "GOLD",
          description: "22K Gold Pendant",
          purityLabel: "22K",
          purityPercent: 91.6,
          grossWeight: 5.0,
          stoneWeight: 0.3,
          rate: 7500,
          packetNumber: "PKT-014",
          storageLocation: "Vault A / Rack 5 / Shelf 1",
        },
      ],
      tenureMonths: 6,
      interestRate: 1.5,
      principalPercent: 85,
      loanDate: subDays(now, 15),
      status: "ACTIVE",
      payments: [],
    },
    // 12. CLOSED — Suresh (2nd loan, paid off)
    {
      customerIdx: 3,
      staffId: staff1Id,
      items: [
        {
          metalType: "GOLD",
          description: "22K Gold Ring",
          purityLabel: "22K",
          purityPercent: 91.6,
          grossWeight: 6.0,
          stoneWeight: 0,
          rate: 7200,
          packetNumber: "PKT-015",
          storageLocation: "Vault A / Rack 5 / Shelf 2",
        },
      ],
      tenureMonths: 3,
      interestRate: 1.5,
      principalPercent: 80,
      loanDate: subMonths(now, 4),
      status: "CLOSED",
      payments: [],
    },
    // 13. Active, current — Rekha (2nd loan)
    {
      customerIdx: 4,
      staffId: staff2Id,
      items: [
        {
          metalType: "GOLD",
          description: "22K Gold Waist Chain",
          purityLabel: "22K",
          purityPercent: 91.6,
          grossWeight: 20.0,
          stoneWeight: 0,
          rate: 7500,
          packetNumber: "PKT-016",
          storageLocation: "Vault A / Rack 5 / Shelf 3",
        },
      ],
      tenureMonths: 12,
      interestRate: 1.5,
      principalPercent: 85,
      loanDate: subDays(now, 20),
      status: "ACTIVE",
      payments: [{ amount: 2000, daysSinceLoan: 15, mode: "BANK_TRANSFER" }],
    },
  ];

  let loanCounter = 0;
  let receiptCounter = 0;

  for (const l of loansData) {
    loanCounter++;
    const customer = customers[l.customerIdx];

    // Compute valuations
    let totalAssessed = new Decimal(0);
    const computedItems = l.items.map((item) => {
      const netWeight = new Decimal(item.grossWeight).minus(new Decimal(item.stoneWeight));
      const fineWeight = netWeight.times(new Decimal(item.purityPercent)).div(new Decimal(100));
      const assessedValue = fineWeight.times(new Decimal(item.rate)).toDecimalPlaces(2);
      totalAssessed = totalAssessed.plus(assessedValue);
      return { ...item, netWeight, fineWeight, assessedValue };
    });

    // Determine LTV
    let ltvPercent: Decimal;
    if (totalAssessed.lte(new Decimal(250000))) {
      ltvPercent = new Decimal(85);
    } else if (totalAssessed.lte(new Decimal(500000))) {
      ltvPercent = new Decimal(80);
    } else {
      ltvPercent = new Decimal(75);
    }

    const eligibleAmount = totalAssessed.times(ltvPercent).div(new Decimal(100)).toDecimalPlaces(2);
    const principalAmount = eligibleAmount
      .times(new Decimal(l.principalPercent))
      .div(new Decimal(100))
      .toDecimalPlaces(2);
    const dueDate = addMonths(l.loanDate, l.tenureMonths);

    const loan = await prisma.loan.create({
      data: {
        loanNumber: loanNumber(loanCounter),
        customerId: customer.id,
        handledById: l.staffId,
        loanDate: l.loanDate,
        dueDate,
        tenureMonths: l.tenureMonths,
        interestRateMonthly: new Decimal(l.interestRate),
        ltvPercent,
        gracePeriodDays: 7,
        totalAssessedValue: totalAssessed,
        principalAmount,
        principalOutstanding: principalAmount,
        lastSettledDate: l.loanDate,
        status: "ACTIVE", // Will update to CLOSED after payments
        items: {
          create: computedItems.map((item) => ({
            metalType: item.metalType,
            description: item.description,
            purityLabel: item.purityLabel,
            purityPercent: new Decimal(item.purityPercent),
            grossWeightGrams: new Decimal(item.grossWeight),
            stoneWeightGrams: new Decimal(item.stoneWeight),
            netWeightGrams: item.netWeight,
            fineWeightGrams: item.fineWeight,
            valuationRatePerGram: new Decimal(item.rate),
            assessedValue: item.assessedValue,
            packetNumber: item.packetNumber,
            storageLocation: item.storageLocation,
          })),
        },
      },
    });

    // Disbursement ledger entry
    await prisma.ledgerEntry.create({
      data: {
        loanId: loan.id,
        type: "DISBURSEMENT",
        amount: principalAmount,
        principalAfter: principalAmount,
        description: `Loan ${loan.loanNumber} disbursed — ₹${principalAmount.toString()}`,
        createdAt: l.loanDate,
      },
    });

    // Processing fee
    if (l.processingFee) {
      await prisma.loanCharge.create({
        data: {
          loanId: loan.id,
          chargeType: "PROCESSING_FEE",
          amount: new Decimal(l.processingFee),
          isSettled: true,
          createdAt: l.loanDate,
        },
      });
    }

    // Record payments
    let currentPrincipal = principalAmount;
    let lastSettledDate = l.loanDate;

    for (const pmt of l.payments) {
      receiptCounter++;
      const paymentDate = new Date(l.loanDate);
      paymentDate.setDate(paymentDate.getDate() + pmt.daysSinceLoan);

      // Compute interest accrued
      const days = Math.max(
        0,
        Math.floor((paymentDate.getTime() - lastSettledDate.getTime()) / (1000 * 60 * 60 * 24))
      );
      const dailyRate = currentPrincipal
        .times(new Decimal(l.interestRate))
        .times(new Decimal(12))
        .div(new Decimal(365))
        .div(new Decimal(100));
      const accruedInterest = dailyRate.times(new Decimal(days)).toDecimalPlaces(2);

      const amount = new Decimal(pmt.amount);
      const allocatedInterest = Decimal.min(amount, accruedInterest);
      const remaining = amount.minus(allocatedInterest);
      const allocatedPrincipal = Decimal.min(remaining, currentPrincipal);

      currentPrincipal = currentPrincipal.minus(allocatedPrincipal);
      lastSettledDate = paymentDate;

      await prisma.payment.create({
        data: {
          loanId: loan.id,
          receiptNumber: receiptNumber(receiptCounter),
          paymentDate,
          amountPaid: amount,
          mode: pmt.mode,
          allocatedCharges: new Decimal(0),
          allocatedInterest,
          allocatedPrincipal,
          collectedById: l.staffId,
          createdAt: paymentDate,
        },
      });

      await prisma.ledgerEntry.create({
        data: {
          loanId: loan.id,
          type: "PAYMENT",
          amount,
          principalAfter: currentPrincipal,
          description: `Payment of ₹${amount.toString()} — Interest: ₹${allocatedInterest.toString()}, Principal: ₹${allocatedPrincipal.toString()}`,
          createdAt: paymentDate,
        },
      });
    }

    // Update loan outstanding
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        principalOutstanding: currentPrincipal,
        lastSettledDate,
      },
    });

    // Handle CLOSED loans
    if (l.status === "CLOSED") {
      // Pay off remaining principal + interest
      const closureDate = addMonths(l.loanDate, l.tenureMonths - 1);
      const days = Math.max(
        0,
        Math.floor((closureDate.getTime() - lastSettledDate.getTime()) / (1000 * 60 * 60 * 24))
      );
      const dailyRate = currentPrincipal
        .times(new Decimal(l.interestRate))
        .times(new Decimal(12))
        .div(new Decimal(365))
        .div(new Decimal(100));
      const finalInterest = dailyRate.times(new Decimal(days)).toDecimalPlaces(2);
      const finalAmount = currentPrincipal.plus(finalInterest);

      if (finalAmount.gt(new Decimal(0))) {
        receiptCounter++;
        await prisma.payment.create({
          data: {
            loanId: loan.id,
            receiptNumber: receiptNumber(receiptCounter),
            paymentDate: closureDate,
            amountPaid: finalAmount,
            mode: "BANK_TRANSFER",
            allocatedCharges: new Decimal(0),
            allocatedInterest: finalInterest,
            allocatedPrincipal: currentPrincipal,
            collectedById: l.staffId,
            createdAt: closureDate,
          },
        });

        await prisma.ledgerEntry.create({
          data: {
            loanId: loan.id,
            type: "PAYMENT",
            amount: finalAmount,
            principalAfter: new Decimal(0),
            description: `Final payment of ₹${finalAmount.toString()} — Interest: ₹${finalInterest.toString()}, Principal: ₹${currentPrincipal.toString()}`,
            createdAt: closureDate,
          },
        });
      }

      // Close the loan
      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          principalOutstanding: new Decimal(0),
          lastSettledDate: closureDate,
          status: "CLOSED",
          closedAt: closureDate,
          closedById: l.staffId,
        },
      });

      await prisma.ledgerEntry.create({
        data: {
          loanId: loan.id,
          type: "CLOSURE",
          amount: new Decimal(0),
          principalAfter: new Decimal(0),
          description: `Loan ${loan.loanNumber} closed — all dues settled`,
          createdAt: closureDate,
        },
      });

      // Release items
      const releaseDate = new Date(closureDate);
      releaseDate.setDate(releaseDate.getDate() + 2);

      await prisma.loanItem.updateMany({
        where: { loanId: loan.id },
        data: { releasedAt: releaseDate },
      });

      await prisma.ledgerEntry.create({
        data: {
          loanId: loan.id,
          type: "ITEM_RELEASE",
          amount: new Decimal(0),
          principalAfter: new Decimal(0),
          description: `${l.items.length} item(s) released to customer`,
          createdAt: releaseDate,
        },
      });
    }

    console.log(
      `  ✅ ${loan.loanNumber} — ${customer.fullName} — ₹${principalAmount.toString()} (${l.status})`
    );
  }

  // ==================== Follow-ups ====================
  console.log("\n📋 Creating follow-ups...");

  const activeLoans = await prisma.loan.findMany({
    where: { status: "ACTIVE" },
    take: 5,
  });

  for (const loan of activeLoans.slice(0, 3)) {
    await prisma.followUp.create({
      data: {
        loanId: loan.id,
        note: "Remind customer about upcoming interest payment",
        dueDate: subDays(loan.dueDate, 14),
        status: "PENDING",
        assignedToId: staff1Id,
      },
    });
  }

  // Overdue follow-ups
  for (const loan of activeLoans.slice(3, 5)) {
    await prisma.followUp.create({
      data: {
        loanId: loan.id,
        note: "Urgent: Contact customer regarding overdue payment",
        dueDate: subDays(now, 3),
        status: "PENDING",
        assignedToId: staff2Id,
      },
    });
  }

  // One completed follow-up
  if (activeLoans.length > 0) {
    await prisma.followUp.create({
      data: {
        loanId: activeLoans[0].id,
        note: "Called customer, confirmed will pay interest by end of week",
        dueDate: subDays(now, 7),
        status: "DONE",
        assignedToId: staff1Id,
      },
    });
  }

  console.log("  ✅ Follow-ups created");

  // ==================== Summary ====================
  const totalLoans = await prisma.loan.count();
  const totalActive = await prisma.loan.count({ where: { status: "ACTIVE" } });
  const totalClosed = await prisma.loan.count({ where: { status: "CLOSED" } });
  const totalPayments = await prisma.payment.count();
  const totalCustomers = await prisma.customer.count();

  console.log("\n" + "=".repeat(50));
  console.log("🎉 Seed completed!");
  console.log(`   Users:     3 (1 admin, 2 staff)`);
  console.log(`   Customers: ${totalCustomers}`);
  console.log(`   Loans:     ${totalLoans} (${totalActive} active, ${totalClosed} closed)`);
  console.log(`   Payments:  ${totalPayments}`);
  console.log("=".repeat(50));
  console.log("\n📧 Login credentials:");
  console.log("   Admin: admin@pawnify.com / password123");
  console.log("   Staff: priya@pawnify.com / password123");
  console.log("   Staff: amit@pawnify.com  / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
