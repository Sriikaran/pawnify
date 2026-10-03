/**
 * Pawnify — Comprehensive Demo Data Seed v3
 *
 * DEVELOPMENT ONLY — Protected by NODE_ENV production guard.
 * Run: npm run db:seed
 *
 * Creates:
 *   - 3 users (1 admin, 2 staff) via Better Auth
 *   - 6 AccountMaster records (CASH-01 CRITICAL for resolveCounterCashAccount)
 *   - 13 realistic Indian customers with KYC documents
 *   - 17 loans: 7 ACTIVE, 5 OVERDUE (ACTIVE past dueDate+grace), 5 CLOSED
 *   - 25+ collateral items (24K/22K/18K gold, sterling silver)
 *   - Charges: PROCESSING_FEE (settled) + PENAL_CHARGE (outstanding, added after payments)
 *   - 30+ payments with correct waterfall: Charges -> Interest -> Principal
 *   - 70+ ledger entries linked to CASH-01/BANK-01 AccountMaster
 *   - 11 follow-ups (PENDING, DONE, CANCELLED)
 *   - 8 AppSettings
 *
 * All monetary values stored at TRUE 100% value.
 * 50% projection mode is presentation-only.
 * DO NOT run in production.
 */
import { PrismaClient, Prisma, KycDocType, FollowUpStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { addMonths, addDays, subDays, subMonths } from "date-fns";
import "dotenv/config";
import { auth } from "../src/lib/auth";
import { hashPassword } from "better-auth/crypto";

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

let _loanSeq = 0;
function nextLoanNumber(): string { _loanSeq++; return `PL-2026-${String(_loanSeq).padStart(6, "0")}`; }
let _receiptSeq = 0;
function nextReceiptNumber(): string { _receiptSeq++; return `RCT-${String(_receiptSeq).padStart(6, "0")}`; }

function computeAccrued(principal: Dec, monthlyRatePct: Dec, from: Date, to: Date): Dec {
  const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
  if (days === 0 || principal.lte(0)) return new D(0);
  return principal.times(monthlyRatePct).times(12).div(365).div(100).times(days).toDecimalPlaces(2);
}

function getLtv(totalAssessed: Dec): Dec {
  if (totalAssessed.lte(250_000)) return new D(85);
  if (totalAssessed.lte(500_000)) return new D(80);
  return new D(75);
}

interface ItemSpec {
  metalType: "GOLD" | "SILVER"; description: string; purityLabel: string;
  purityPercent: number; grossWeightGrams: number; stoneWeightGrams: number;
  valuationRatePerGram: number; packetNumber: string; storageLocation: string;
}
interface ComputedItem extends ItemSpec { netWeightGrams: Dec; fineWeightGrams: Dec; assessedValue: Dec; }
function computeItem(spec: ItemSpec): ComputedItem {
  const netWeight = new D(spec.grossWeightGrams).minus(spec.stoneWeightGrams);
  const fineWeight = netWeight.times(spec.purityPercent).div(100).toDecimalPlaces(3);
  const assessedValue = fineWeight.times(spec.valuationRatePerGram).toDecimalPlaces(2);
  return { ...spec, netWeightGrams: netWeight, fineWeightGrams: fineWeight, assessedValue };
}

interface ChargeInput { id: string; amount: Dec; }
interface WaterfallInput {
  principal: Dec; monthlyRate: Dec; lastSettledDate: Date;
  charges: ChargeInput[]; paymentDate: Date; amountPaid: Dec;
}
interface WaterfallResult {
  allocatedCharges: Dec; allocatedInterest: Dec; allocatedPrincipal: Dec;
  newPrincipal: Dec; newLastSettledDate: Date;
  chargeSettlements: { id: string; fullySettled: boolean }[];
}
function computeWaterfall(input: WaterfallInput): WaterfallResult {
  let remaining = input.amountPaid;
  let allocatedCharges = new D(0);
  const chargeSettlements: { id: string; fullySettled: boolean }[] = [];
  for (const charge of input.charges) {
    if (remaining.lte(0)) break;
    const pay = D.min(remaining, charge.amount);
    allocatedCharges = allocatedCharges.plus(pay);
    remaining = remaining.minus(pay);
    chargeSettlements.push({ id: charge.id, fullySettled: pay.gte(charge.amount) });
  }
  const accrued = computeAccrued(input.principal, input.monthlyRate, input.lastSettledDate, input.paymentDate);
  const allocatedInterest = D.min(remaining, accrued);
  remaining = remaining.minus(allocatedInterest);
  const allocatedPrincipal = D.min(remaining, input.principal);
  const newPrincipal = input.principal.minus(allocatedPrincipal);
  const daysElapsed = Math.max(0, Math.floor((input.paymentDate.getTime() - input.lastSettledDate.getTime()) / 86_400_000));
  let newLastSettledDate = input.paymentDate;
  if (daysElapsed > 0 && accrued.gt(0) && allocatedInterest.lt(accrued)) {
    const paidDays = allocatedInterest.div(accrued).times(daysElapsed).toNumber();
    newLastSettledDate = new Date(input.lastSettledDate.getTime() + paidDays * 86_400_000);
  }
  return { allocatedCharges, allocatedInterest, allocatedPrincipal, newPrincipal, newLastSettledDate, chargeSettlements };
}
async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    console.error("Refusing to run destructive development seed in production!");
    process.exit(1);
  }
  console.log("Seeding Pawnify Demo Database v3...\n");

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
  await prisma.accountMaster.deleteMany();

  await prisma.appSetting.createMany({
    data: [
      { key: "ltv.tier1.max", value: "250000" },
      { key: "ltv.tier1.percent", value: "85" },
      { key: "ltv.tier2.max", value: "500000" },
      { key: "ltv.tier2.percent", value: "80" },
      { key: "ltv.tier3.percent", value: "75" },
      { key: "interest.default.monthly", value: "1.500" },
      { key: "grace.period.days", value: "7" },
      { key: "pan.threshold", value: "50000" },
    ],
  });

  // CASH-01 is CRITICAL — resolveCounterCashAccount() requires code=CASH-01, type=ASSET, isActive=true
  const cashAccount = await prisma.accountMaster.create({
    data: { code: "CASH-01", name: "Counter Cash", type: "ASSET", isActive: true,
      description: "Primary cash counter for gold loan disbursements and cash collections" },
  });
  const bankAccount = await prisma.accountMaster.create({
    data: { code: "BANK-01", name: "HDFC Bank Current Account", type: "ASSET", isActive: true,
      description: "HDFC Bank branch current account for UPI/NEFT/RTGS collections" },
  });
  await prisma.accountMaster.create({
    data: { code: "LOAN-RECV", name: "Loan Receivables Portfolio", type: "ASSET", isActive: true,
      description: "Gold loan portfolio tracking account" },
  });
  await prisma.accountMaster.create({
    data: { code: "INT-INC", name: "Interest Income", type: "INCOME", isActive: true,
      description: "Revenue from loan interest collections" },
  });
  await prisma.accountMaster.create({
    data: { code: "PROC-INC", name: "Processing Fee Income", type: "INCOME", isActive: true,
      description: "Revenue from processing charges" },
  });
  await prisma.accountMaster.create({
    data: { code: "OLD-SAFE", name: "Old Jewelry Safe (Decommissioned)", type: "ASSET", isActive: false,
      description: "Decommissioned vault replaced by Vault A" },
  });

  const hiddenHash = await hashPassword("hidden123");
  const resAdmin = await auth.api.signUpEmail({ body: { email: "admin@pawnify.com", password: "password123", name: "Rajesh Kumar", phone: "9876543210" } });
  const adminId = resAdmin.user.id;
  await prisma.user.update({ where: { id: adminId }, data: { role: "ADMIN", emailVerified: true, isActive: true, phone: "9876543210", hiddenPasswordHash: hiddenHash } });
  const resStaff1 = await auth.api.signUpEmail({ body: { email: "priya@pawnify.com", password: "password123", name: "Priya Sharma", phone: "9876543211" } });
  const staff1Id = resStaff1.user.id;
  await prisma.user.update({ where: { id: staff1Id }, data: { role: "STAFF", emailVerified: true, isActive: true, phone: "9876543211", hiddenPasswordHash: hiddenHash } });
  const resStaff2 = await auth.api.signUpEmail({ body: { email: "amit@pawnify.com", password: "password123", name: "Amit Patel", phone: "9876543212" } });
  const staff2Id = resStaff2.user.id;
  await prisma.user.update({ where: { id: staff2Id }, data: { role: "STAFF", emailVerified: true, isActive: true, phone: "9876543212", hiddenPasswordHash: hiddenHash } });
  console.log("Users created: admin@pawnify.com / priya@pawnify.com / amit@pawnify.com");

  // ── Customers ─────────────────────────────────────────────────────────────────
  interface KycSpec { docType: string; docNumber: string; status: "VERIFIED" | "PENDING" | "REJECTED"; }
  interface CustomerSpec {
    fullName: string; phone: string; email: string | null;
    addressLine1: string; city: string; state: string; pincode: string; kyc: KycSpec[];
  }
  const customersData: CustomerSpec[] = [
    { fullName: "Lakshmi Devi", phone: "9845010001", email: "lakshmi.devi@gmail.com",
      addressLine1: "12, Gandhi Nagar, 1st Cross", city: "Chennai", state: "Tamil Nadu", pincode: "600001",
      kyc: [{ docType: "AADHAAR", docNumber: "234511891234", status: "VERIFIED" }, { docType: "PAN", docNumber: "ABCDE1234F", status: "VERIFIED" }] },
    { fullName: "Mohammed Farooq", phone: "9845010002", email: "farooq.m@gmail.com",
      addressLine1: "45, Jubilee Hills, Road No. 36", city: "Hyderabad", state: "Telangana", pincode: "500033",
      kyc: [{ docType: "AADHAAR", docNumber: "345622912345", status: "VERIFIED" }, { docType: "PAN", docNumber: "FGHIJ5678K", status: "PENDING" }] },
    { fullName: "Anita Verma", phone: "9845010003", email: "anita.verma@gmail.com",
      addressLine1: "78, MG Road, Shivajinagar", city: "Bengaluru", state: "Karnataka", pincode: "560001",
      kyc: [{ docType: "PAN", docNumber: "LMNOP6789Q", status: "VERIFIED" }, { docType: "VOTER_ID", docNumber: "KA012345678", status: "PENDING" }] },
    { fullName: "Suresh Babu", phone: "9845010004", email: null,
      addressLine1: "23, Anna Salai, Near LIC Building", city: "Madurai", state: "Tamil Nadu", pincode: "625001",
      kyc: [{ docType: "AADHAAR", docNumber: "456789323456", status: "VERIFIED" }] },
    { fullName: "Rekha Menon", phone: "9845010005", email: "rekha.menon@gmail.com",
      addressLine1: "56, Park Street, Near Park Hotel", city: "Kolkata", state: "West Bengal", pincode: "700016",
      kyc: [{ docType: "AADHAAR", docNumber: "567891434567", status: "VERIFIED" }, { docType: "PAN", docNumber: "RSTUV7890W", status: "VERIFIED" }, { docType: "PASSPORT", docNumber: "N1234567", status: "VERIFIED" }] },
    { fullName: "Ravi Shankar", phone: "9845010006", email: null,
      addressLine1: "89, Civil Lines, Near Collectorate", city: "Jaipur", state: "Rajasthan", pincode: "302001",
      kyc: [{ docType: "AADHAAR", docNumber: "678912545678", status: "PENDING" }] },
    { fullName: "Deepa Krishnan", phone: "9845010007", email: "deepa.krishnan@gmail.com",
      addressLine1: "34, Cathedral Road, Gopalapuram", city: "Chennai", state: "Tamil Nadu", pincode: "600086",
      kyc: [{ docType: "PAN", docNumber: "WXYZ12345A", status: "VERIFIED" }, { docType: "PASSPORT", docNumber: "A9876543", status: "VERIFIED" }] },
    { fullName: "Vijay Menon", phone: "9845010008", email: "vijay.menon@gmail.com",
      addressLine1: "12, Bandra West, Turner Road", city: "Mumbai", state: "Maharashtra", pincode: "400050",
      kyc: [{ docType: "AADHAAR", docNumber: "789123456899", status: "REJECTED" }, { docType: "PAN", docNumber: "QRSTU6789V", status: "VERIFIED" }] },
    { fullName: "Preethi Nair", phone: "9845010009", email: "preethi.nair@gmail.com",
      addressLine1: "5, MG Road, Vytilla Junction", city: "Kochi", state: "Kerala", pincode: "682019",
      kyc: [{ docType: "AADHAAR", docNumber: "890123567890", status: "VERIFIED" }, { docType: "PAN", docNumber: "BCDEF2345G", status: "VERIFIED" }] },
    { fullName: "Arjun Reddy", phone: "9845010010", email: "arjun.reddy@gmail.com",
      addressLine1: "77, Film Nagar, Jubilee Hills", city: "Hyderabad", state: "Telangana", pincode: "500096",
      kyc: [{ docType: "AADHAAR", docNumber: "901234678901", status: "VERIFIED" }] },
    { fullName: "Sunita Gupta", phone: "9845010011", email: null,
      addressLine1: "42, Karol Bagh, Near Metro Station", city: "New Delhi", state: "Delhi", pincode: "110005",
      kyc: [{ docType: "AADHAAR", docNumber: "112345789012", status: "VERIFIED" }, { docType: "PAN", docNumber: "GHIJK3456L", status: "VERIFIED" }] },
    { fullName: "Kiran Kumar", phone: "9845010012", email: "kiran.kumar@gmail.com",
      addressLine1: "8, FC Road, Deccan Gymkhana", city: "Pune", state: "Maharashtra", pincode: "411004",
      kyc: [{ docType: "AADHAAR", docNumber: "223456890123", status: "VERIFIED" }, { docType: "DRIVING_LICENSE", docNumber: "MH12-2023-1234567", status: "PENDING" }] },
    { fullName: "Meera Pillai", phone: "9845010013", email: "meera.pillai@gmail.com",
      addressLine1: "3, Vazhuthacaud, Near State Museum", city: "Thiruvananthapuram", state: "Kerala", pincode: "695014",
      kyc: [{ docType: "AADHAAR", docNumber: "334567901234", status: "VERIFIED" }, { docType: "PAN", docNumber: "MNOPQ4567R", status: "VERIFIED" }] },
  ];

  const customers: { id: string; fullName: string }[] = [];
  const staffRota = [adminId, staff1Id, staff2Id];
  for (let i = 0; i < customersData.length; i++) {
    const c = customersData[i];
    const customer = await prisma.customer.create({
      data: {
        fullName: c.fullName, phone: c.phone, email: c.email,
        addressLine1: c.addressLine1, city: c.city, state: c.state, pincode: c.pincode,
        createdById: staffRota[i % 3],
        kycDocuments: { create: c.kyc.map((k) => ({ docType: k.docType as KycDocType, docNumber: k.docNumber, status: k.status, verifiedById: k.status === "VERIFIED" ? adminId : null })) },
      },
    });
    customers.push({ id: customer.id, fullName: customer.fullName });
    console.log(`  Customer: ${customer.fullName}`);
  }

  // ── Loan Specs ────────────────────────────────────────────────────────────────
  const GOLD_RATE = 8200; const SILVER_RATE = 100;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  interface PaymentSpec { amount: number; daysSinceLoan: number; mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CARD"; }
  interface LoanSpec {
    label: string; customerIdx: number; staffId: string; items: ItemSpec[];
    tenureMonths: number; interestRate: number; principalAmount: number; gracePeriodDays: number;
    loanDate: Date; targetStatus: "ACTIVE" | "CLOSED";
    processingFee?: number; penalCharge?: number; payments: PaymentSpec[]; notes?: string;
  }

  const loansSpec: LoanSpec[] = [
    // ACTIVE — A1 Lakshmi TODAY
    { label: "A1", customerIdx: 0, staffId: staff1Id,
      items: [{ metalType: "GOLD", description: "22K Gold Necklace Set (Antique Finish)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 32.5, stoneWeightGrams: 1.2, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-A001", storageLocation: "Vault A / Rack 1 / Shelf 1" }],
      tenureMonths: 12, interestRate: 1.5, principalAmount: 180_000, gracePeriodDays: 7, loanDate: today, targetStatus: "ACTIVE", processingFee: 1800, payments: [] },
    // ACTIVE — A2 Preethi 3 days ago
    { label: "A2", customerIdx: 8, staffId: staff2Id,
      items: [{ metalType: "GOLD", description: "22K Gold Bangles (Kangan, Pair)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 24.8, stoneWeightGrams: 0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-A002", storageLocation: "Vault A / Rack 1 / Shelf 2" }],
      tenureMonths: 6, interestRate: 1.5, principalAmount: 140_000, gracePeriodDays: 7, loanDate: subDays(today, 3), targetStatus: "ACTIVE", payments: [] },
    // ACTIVE — A3 Mohammed 2nd 21 days
    { label: "A3", customerIdx: 1, staffId: staff1Id,
      items: [
        { metalType: "GOLD", description: "22K Gold Jhumki Earrings (Pair)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 15.2, stoneWeightGrams: 0.8, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-A003", storageLocation: "Vault A / Rack 1 / Shelf 3" },
        { metalType: "GOLD", description: "18K Gold Ring with Diamond", purityLabel: "18K", purityPercent: 75.0, grossWeightGrams: 7.5, stoneWeightGrams: 1.5, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-A004", storageLocation: "Vault A / Rack 1 / Shelf 4" },
      ],
      tenureMonths: 6, interestRate: 1.5, principalAmount: 85_000, gracePeriodDays: 7, loanDate: subDays(today, 21), targetStatus: "ACTIVE",
      payments: [{ amount: 3_500, daysSinceLoan: 15, mode: "UPI" }] },
    // ACTIVE — A4 Suresh 2nd 42 days (payment TODAY)
    { label: "A4", customerIdx: 3, staffId: staff2Id,
      items: [{ metalType: "GOLD", description: "24K Gold Bar (10g Hallmarked)", purityLabel: "24K", purityPercent: 99.9, grossWeightGrams: 10.0, stoneWeightGrams: 0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-A005", storageLocation: "Vault A / Rack 2 / Shelf 1" }],
      tenureMonths: 6, interestRate: 1.5, principalAmount: 65_000, gracePeriodDays: 7, loanDate: subDays(today, 42), targetStatus: "ACTIVE",
      payments: [{ amount: 1_500, daysSinceLoan: 20, mode: "CASH" }, { amount: 1_500, daysSinceLoan: 38, mode: "CASH" }, { amount: 2_000, daysSinceLoan: 42, mode: "UPI" }] },
    // ACTIVE — A5 Rekha 2nd 3 months
    { label: "A5", customerIdx: 4, staffId: adminId,
      items: [{ metalType: "GOLD", description: "22K Gold Temple Jewellery Set (Kemp)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 55.0, stoneWeightGrams: 3.5, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-A006", storageLocation: "Vault A / Rack 2 / Shelf 2" }],
      tenureMonths: 12, interestRate: 1.25, principalAmount: 285_000, gracePeriodDays: 7, loanDate: subMonths(today, 3), targetStatus: "ACTIVE", processingFee: 2_850,
      payments: [{ amount: 5_000, daysSinceLoan: 30, mode: "UPI" }, { amount: 5_000, daysSinceLoan: 60, mode: "UPI" }, { amount: 8_000, daysSinceLoan: 88, mode: "BANK_TRANSFER" }],
      notes: "High-value temple jewellery — LTV 80%" },
    // ACTIVE — A6 Deepa 45 days high-value
    { label: "A6", customerIdx: 6, staffId: adminId,
      items: [
        { metalType: "GOLD", description: "22K Gold Waist Chain (Oddiyanam)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 75.0, stoneWeightGrams: 2.0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-A007", storageLocation: "Vault A / Rack 2 / Shelf 3" },
        { metalType: "GOLD", description: "24K Gold Coin (20g Hallmarked)", purityLabel: "24K", purityPercent: 99.9, grossWeightGrams: 20.0, stoneWeightGrams: 0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-A008", storageLocation: "Vault A / Rack 2 / Shelf 4" },
      ],
      tenureMonths: 12, interestRate: 1.25, principalAmount: 420_000, gracePeriodDays: 14, loanDate: subDays(today, 45), targetStatus: "ACTIVE", processingFee: 4_200,
      payments: [], notes: "Ultra-high value 2-item loan — LTV 75%" },
    // ACTIVE — A7 Meera 6 days
    { label: "A7", customerIdx: 12, staffId: staff1Id,
      items: [{ metalType: "GOLD", description: "22K Gold Thali Chain (Thick)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 18.5, stoneWeightGrams: 0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-A009", storageLocation: "Vault A / Rack 3 / Shelf 1" }],
      tenureMonths: 6, interestRate: 1.5, principalAmount: 105_000, gracePeriodDays: 7, loanDate: subDays(today, 6), targetStatus: "ACTIVE", payments: [] },
    // OVERDUE — O1 Mohammed 1st 8mo
    { label: "O1", customerIdx: 1, staffId: staff2Id,
      items: [{ metalType: "GOLD", description: "22K Gold Pendant & Chain Set", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 12.0, stoneWeightGrams: 0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-O001", storageLocation: "Vault A / Rack 3 / Shelf 2" }],
      tenureMonths: 3, interestRate: 1.5, principalAmount: 55_000, gracePeriodDays: 7, loanDate: subMonths(today, 8), targetStatus: "ACTIVE",
      payments: [], notes: "Non-responsive customer — 5 months overdue" },
    // OVERDUE — O2 Anita 9mo silver
    { label: "O2", customerIdx: 2, staffId: staff1Id,
      items: [{ metalType: "SILVER", description: "Fine Silver Puja Set (1kg Pooja Samagri)", purityLabel: "Fine Silver", purityPercent: 99.9, grossWeightGrams: 1_020.0, stoneWeightGrams: 0, valuationRatePerGram: SILVER_RATE, packetNumber: "PKT-O002", storageLocation: "Vault B / Rack 1 / Shelf 1" }],
      tenureMonths: 6, interestRate: 1.8, principalAmount: 72_000, gracePeriodDays: 7, loanDate: subMonths(today, 9), targetStatus: "ACTIVE",
      payments: [{ amount: 3_000, daysSinceLoan: 60, mode: "CASH" }] },
    // OVERDUE — O3 Ravi 7mo 2 payments
    { label: "O3", customerIdx: 5, staffId: staff2Id,
      items: [{ metalType: "GOLD", description: "18K Gold Bracelet with Diamond Chips", purityLabel: "18K", purityPercent: 75.0, grossWeightGrams: 22.5, stoneWeightGrams: 3.0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-O003", storageLocation: "Vault A / Rack 4 / Shelf 1" }],
      tenureMonths: 3, interestRate: 2.0, principalAmount: 78_000, gracePeriodDays: 7, loanDate: subMonths(today, 7), targetStatus: "ACTIVE",
      payments: [{ amount: 2_500, daysSinceLoan: 45, mode: "CASH" }, { amount: 2_500, daysSinceLoan: 90, mode: "CASH" }] },
    // OVERDUE — O4 Vijay 8mo penal charge
    { label: "O4", customerIdx: 7, staffId: staff1Id,
      items: [{ metalType: "GOLD", description: "22K Gold Flat Necklace (Paati Haar)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 28.0, stoneWeightGrams: 0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-O004", storageLocation: "Vault A / Rack 4 / Shelf 2" }],
      tenureMonths: 3, interestRate: 2.0, principalAmount: 128_000, gracePeriodDays: 7, loanDate: subMonths(today, 8), targetStatus: "ACTIVE",
      penalCharge: 2_000, payments: [{ amount: 5_000, daysSinceLoan: 30, mode: "CASH" }] },
    // OVERDUE — O5 Sunita 12mo no payment
    { label: "O5", customerIdx: 10, staffId: staff2Id,
      items: [{ metalType: "GOLD", description: "22K Gold Bangles Set (6 pieces, Traditional)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 62.4, stoneWeightGrams: 0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-O005", storageLocation: "Vault A / Rack 5 / Shelf 1" }],
      tenureMonths: 6, interestRate: 1.8, principalAmount: 250_000, gracePeriodDays: 7, loanDate: subMonths(today, 12), targetStatus: "ACTIVE",
      payments: [], notes: "Oldest overdue — substantial accrued interest" },
    // CLOSED — C1 Lakshmi 1st
    { label: "C1", customerIdx: 0, staffId: staff1Id,
      items: [{ metalType: "GOLD", description: "22K Gold Chain (Medium Weight)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 25.0, stoneWeightGrams: 0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-C001", storageLocation: "Vault A / Rack 5 / Shelf 2" }],
      tenureMonths: 6, interestRate: 1.5, principalAmount: 115_000, gracePeriodDays: 7, loanDate: subMonths(today, 12), targetStatus: "CLOSED", processingFee: 1_150, payments: [] },
    // CLOSED — C2 Suresh 1st
    { label: "C2", customerIdx: 3, staffId: staff2Id,
      items: [{ metalType: "GOLD", description: "22K Gold Band Ring (Plain)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 8.5, stoneWeightGrams: 0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-C002", storageLocation: "Vault A / Rack 5 / Shelf 3" }],
      tenureMonths: 6, interestRate: 1.5, principalAmount: 38_000, gracePeriodDays: 7, loanDate: subMonths(today, 10), targetStatus: "CLOSED", payments: [] },
    // CLOSED — C3 Rekha 1st
    { label: "C3", customerIdx: 4, staffId: adminId,
      items: [{ metalType: "GOLD", description: "22K Gold Vaddanam (Waist Belt Ornament)", purityLabel: "22K", purityPercent: 91.6, grossWeightGrams: 42.0, stoneWeightGrams: 1.0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-C003", storageLocation: "Vault A / Rack 6 / Shelf 1" }],
      tenureMonths: 6, interestRate: 1.5, principalAmount: 182_000, gracePeriodDays: 7, loanDate: subMonths(today, 9), targetStatus: "CLOSED", processingFee: 1_820, payments: [] },
    // CLOSED — C4 Arjun 2 items
    { label: "C4", customerIdx: 9, staffId: staff1Id,
      items: [
        { metalType: "GOLD", description: "24K Gold Bar (5g Hallmarked)", purityLabel: "24K", purityPercent: 99.9, grossWeightGrams: 5.0, stoneWeightGrams: 0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-C004", storageLocation: "Vault A / Rack 6 / Shelf 2" },
        { metalType: "GOLD", description: "18K Gold Earrings with Emerald", purityLabel: "18K", purityPercent: 75.0, grossWeightGrams: 6.8, stoneWeightGrams: 2.0, valuationRatePerGram: GOLD_RATE, packetNumber: "PKT-C005", storageLocation: "Vault A / Rack 6 / Shelf 3" },
      ],
      tenureMonths: 6, interestRate: 1.5, principalAmount: 52_000, gracePeriodDays: 7, loanDate: subMonths(today, 8), targetStatus: "CLOSED", payments: [] },
    // CLOSED — C5 Kiran silver
    { label: "C5", customerIdx: 11, staffId: staff2Id,
      items: [{ metalType: "SILVER", description: "Sterling Silver Anklets (Pair, Heavy)", purityLabel: "Sterling Silver", purityPercent: 92.5, grossWeightGrams: 165.0, stoneWeightGrams: 0, valuationRatePerGram: SILVER_RATE, packetNumber: "PKT-C006", storageLocation: "Vault B / Rack 1 / Shelf 2" }],
      tenureMonths: 6, interestRate: 1.8, principalAmount: 12_000, gracePeriodDays: 7, loanDate: subMonths(today, 6), targetStatus: "CLOSED", payments: [] },
  ];

  // ── Process each loan ─────────────────────────────────────────────────────────
  console.log("\nCreating loans and financial data...");
  for (const spec of loansSpec) {
    const customer = customers[spec.customerIdx];
    const loanDate = spec.loanDate;
    const dueDate = addMonths(loanDate, spec.tenureMonths);
    const loanNumber = nextLoanNumber();
    const computedItems = spec.items.map(computeItem);
    const totalAssessedValue = computedItems.reduce((sum, i) => sum.plus(i.assessedValue), new D(0));
    const ltv = getLtv(totalAssessedValue);
    const eligibleAmount = totalAssessedValue.times(ltv).div(100).toDecimalPlaces(2);
    const principalAmount = new D(spec.principalAmount);
    if (principalAmount.gt(eligibleAmount)) {
      throw new Error(`${spec.label}: principal ${principalAmount} > eligible ${eligibleAmount} (assessed ${totalAssessedValue}, LTV ${ltv}%)`);
    }
    const loan = await prisma.loan.create({
      data: {
        loanNumber, customerId: customer.id, handledById: spec.staffId,
        loanDate, dueDate, tenureMonths: spec.tenureMonths,
        interestRateMonthly: new D(spec.interestRate), ltvPercent: ltv, gracePeriodDays: spec.gracePeriodDays,
        totalAssessedValue, principalAmount, principalOutstanding: principalAmount,
        lastSettledDate: loanDate, status: "ACTIVE", notes: spec.notes || null,
        items: { create: computedItems.map((item) => ({
          metalType: item.metalType, description: item.description, purityLabel: item.purityLabel,
          purityPercent: new D(item.purityPercent), grossWeightGrams: new D(item.grossWeightGrams),
          stoneWeightGrams: new D(item.stoneWeightGrams), netWeightGrams: item.netWeightGrams,
          fineWeightGrams: item.fineWeightGrams, valuationRatePerGram: new D(item.valuationRatePerGram),
          assessedValue: item.assessedValue, packetNumber: item.packetNumber, storageLocation: item.storageLocation,
        })) },
      },
    });
    // DISBURSEMENT ledger entry → CASH-01
    await prisma.ledgerEntry.create({
      data: {
        loanId: loan.id, accountId: cashAccount.id, type: "DISBURSEMENT",
        amount: principalAmount, principalAfter: principalAmount,
        description: `Loan ${loanNumber} disbursed — ${principalAmount.toFixed(2)} against ${spec.items.length} item(s) valued ${totalAssessedValue.toFixed(2)} (LTV: ${ltv}%)`,
        createdAt: loanDate,
      },
    });
    // Processing fee
    if (spec.processingFee) {
      await prisma.loanCharge.create({ data: { loanId: loan.id, chargeType: "PROCESSING_FEE", amount: new D(spec.processingFee), isSettled: false, createdAt: loanDate } });
    }
    // Payments (waterfall: charges -> interest -> principal)
    let currentPrincipal = principalAmount;
    let lastSettledDate = loanDate;
    for (const pmtSpec of spec.payments) {
      const paymentDate = new Date(loanDate);
      paymentDate.setDate(paymentDate.getDate() + pmtSpec.daysSinceLoan);
      const unsettledCharges = await prisma.loanCharge.findMany({ where: { loanId: loan.id, isSettled: false }, orderBy: { createdAt: "asc" }, select: { id: true, amount: true } });
      const wf = computeWaterfall({ principal: currentPrincipal, monthlyRate: new D(spec.interestRate), lastSettledDate, charges: unsettledCharges, paymentDate, amountPaid: new D(pmtSpec.amount) });
      for (const cs of wf.chargeSettlements) { if (cs.fullySettled) { await prisma.loanCharge.update({ where: { id: cs.id }, data: { isSettled: true } }); } }
      const receiptNumber = nextReceiptNumber();
      const payment = await prisma.payment.create({
        data: {
          loanId: loan.id, receiptNumber, paymentDate, amountPaid: new D(pmtSpec.amount), mode: pmtSpec.mode,
          allocatedCharges: wf.allocatedCharges, allocatedInterest: wf.allocatedInterest, allocatedPrincipal: wf.allocatedPrincipal,
          collectedById: spec.staffId, createdAt: paymentDate,
        },
      });
      const payAccountId = pmtSpec.mode === "CASH" ? cashAccount.id : bankAccount.id;
      await prisma.ledgerEntry.create({
        data: {
          loanId: loan.id, accountId: payAccountId, type: "PAYMENT",
          amount: new D(pmtSpec.amount), principalAfter: wf.newPrincipal, referenceId: payment.id,
          description: `Payment ${pmtSpec.amount} via ${pmtSpec.mode} — Charges:${wf.allocatedCharges.toFixed(2)} Interest:${wf.allocatedInterest.toFixed(2)} Principal:${wf.allocatedPrincipal.toFixed(2)}`,
          createdAt: paymentDate,
        },
      });
      currentPrincipal = wf.newPrincipal;
      lastSettledDate = wf.newLastSettledDate;
    }
    // Penal charge AFTER payments (stays outstanding)
    if (spec.penalCharge) {
      await prisma.loanCharge.create({ data: { loanId: loan.id, chargeType: "PENAL_CHARGE", amount: new D(spec.penalCharge), isSettled: false, createdAt: addDays(dueDate, 15) } });
    }
    // Update loan outstanding
    await prisma.loan.update({ where: { id: loan.id }, data: { principalOutstanding: currentPrincipal, lastSettledDate } });
    // Closure
    if (spec.targetStatus === "CLOSED") {
      const closureDate = addMonths(loanDate, spec.tenureMonths - 1);
      const remainingCharges = await prisma.loanCharge.findMany({ where: { loanId: loan.id, isSettled: false }, orderBy: { createdAt: "asc" }, select: { id: true, amount: true } });
      const totalRemainingCharges = remainingCharges.reduce((s, c) => s.plus(c.amount), new D(0));
      const finalInterest = computeAccrued(currentPrincipal, new D(spec.interestRate), lastSettledDate, closureDate);
      const finalAmount = currentPrincipal.plus(finalInterest).plus(totalRemainingCharges);
      if (finalAmount.gt(0)) {
        for (const rc of remainingCharges) { await prisma.loanCharge.update({ where: { id: rc.id }, data: { isSettled: true } }); }
        const receiptNumber = nextReceiptNumber();
        const finalPayment = await prisma.payment.create({
          data: { loanId: loan.id, receiptNumber, paymentDate: closureDate, amountPaid: finalAmount, mode: "BANK_TRANSFER", allocatedCharges: totalRemainingCharges, allocatedInterest: finalInterest, allocatedPrincipal: currentPrincipal, collectedById: spec.staffId, createdAt: closureDate },
        });
        await prisma.ledgerEntry.create({ data: { loanId: loan.id, accountId: bankAccount.id, type: "PAYMENT", amount: finalAmount, principalAfter: new D(0), referenceId: finalPayment.id, description: `Closure payment ${finalAmount.toFixed(2)} BANK_TRANSFER — Int:${finalInterest.toFixed(2)} Prin:${currentPrincipal.toFixed(2)}`, createdAt: closureDate } });
      }
      await prisma.loan.update({ where: { id: loan.id }, data: { principalOutstanding: new D(0), lastSettledDate: closureDate, status: "CLOSED", closedAt: closureDate, closedById: spec.staffId } });
      await prisma.ledgerEntry.create({ data: { loanId: loan.id, accountId: null, type: "CLOSURE", amount: new D(0), principalAfter: new D(0), description: `Loan ${loanNumber} fully closed by ${customer.fullName}`, createdAt: closureDate } });
      const releaseDate = addDays(closureDate, 2);
      await prisma.loanItem.updateMany({ where: { loanId: loan.id, releasedAt: null }, data: { releasedAt: releaseDate } });
      await prisma.ledgerEntry.create({ data: { loanId: loan.id, accountId: null, type: "ITEM_RELEASE", amount: new D(0), principalAfter: new D(0), description: `${spec.items.length} item(s) released to ${customer.fullName}`, createdAt: releaseDate } });
    }
    const graceMs = spec.gracePeriodDays * 86_400_000;
    const displayStatus = spec.targetStatus === "CLOSED" ? "CLOSED" : Date.now() > dueDate.getTime() + graceMs ? "OVERDUE" : "ACTIVE";
    console.log(`  ${loanNumber} ${customer.fullName} ${displayStatus} P=${principalAmount.toFixed(0)}`);
  }

  // ── Follow-ups ────────────────────────────────────────────────────────────────
  const allActiveLoans = await prisma.loan.findMany({ where: { status: "ACTIVE" }, orderBy: { loanDate: "asc" }, take: 12 });
  interface FuSpec { loanIdx: number; note: string; dueDate: Date; status: string; staffId: string; }
  const fuSpecs: FuSpec[] = [
    { loanIdx: 7,  note: "First interest payment reminder — loan disbursed today", dueDate: addDays(today, 30), status: "PENDING", staffId: staff1Id },
    { loanIdx: 8,  note: "Monthly interest reminder — collect ₹3,150 by month end", dueDate: addDays(today, 24), status: "PENDING", staffId: staff2Id },
    { loanIdx: 9,  note: "Customer promised partial interest — confirm receipt", dueDate: addDays(today, 7), status: "PENDING", staffId: staff1Id },
    { loanIdx: 10, note: "3-month review call — discuss renewal or settlement options", dueDate: addDays(today, 14), status: "PENDING", staffId: adminId },
    { loanIdx: 0,  note: "URGENT: 5+ months overdue — initiate legal notice process", dueDate: subDays(today, 5), status: "PENDING", staffId: adminId },
    { loanIdx: 1,  note: "URGENT: Non-responsive 3 months — send registered notice", dueDate: subDays(today, 14), status: "PENDING", staffId: staff1Id },
    { loanIdx: 2,  note: "Follow up on penal charge — customer promised to pay last week", dueDate: subDays(today, 7), status: "PENDING", staffId: staff2Id },
    { loanIdx: 7,  note: "Welcome call complete — explained interest schedule", dueDate: subDays(today, 1), status: "DONE", staffId: staff1Id },
    { loanIdx: 8,  note: "Called customer — will visit this week to pay interest", dueDate: subDays(today, 5), status: "DONE", staffId: staff2Id },
    { loanIdx: 9,  note: "Customer visited and made partial payment", dueDate: subDays(today, 10), status: "DONE", staffId: staff1Id },
    { loanIdx: 10, note: "Scheduled home visit cancelled — customer relocated temporarily", dueDate: subDays(today, 30), status: "CANCELLED", staffId: adminId },
  ];
  for (const fu of fuSpecs) {
    const loan = allActiveLoans[fu.loanIdx];
    if (!loan) continue;
    await prisma.followUp.create({ data: { loanId: loan.id, note: fu.note, dueDate: fu.dueDate, status: fu.status as FollowUpStatus, assignedToId: fu.staffId } });
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  const [cCust, cLoan, cActive, cClosed, cPay, cLedger, cAcct, cFu, cItem, cCharge, cSetting] = await Promise.all([
    prisma.customer.count(), prisma.loan.count(),
    prisma.loan.count({ where: { status: "ACTIVE" } }),
    prisma.loan.count({ where: { status: "CLOSED" } }),
    prisma.payment.count(), prisma.ledgerEntry.count(), prisma.accountMaster.count(),
    prisma.followUp.count(), prisma.loanItem.count(), prisma.loanCharge.count(), prisma.appSetting.count(),
  ]);
  const [disbAgg, collAgg] = await Promise.all([
    prisma.ledgerEntry.aggregate({ where: { type: "DISBURSEMENT" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ _sum: { amountPaid: true } }),
  ]);
  console.log("\n" + "=".repeat(60));
  console.log("Pawnify Demo Seed v3 — Complete!");
  console.log("=".repeat(60));
  console.log(`Users:          3 (1 admin, 2 staff)`);
  console.log(`Customers:      ${cCust}`);
  console.log(`Loans:          ${cLoan} (${cActive} active/overdue, ${cClosed} closed)`);
  console.log(`Items:          ${cItem}`);
  console.log(`Charges:        ${cCharge}`);
  console.log(`Payments:       ${cPay}`);
  console.log(`Ledger entries: ${cLedger}`);
  console.log(`Accounts:       ${cAcct} (5 active, 1 inactive)`);
  console.log(`Follow-ups:     ${cFu}`);
  console.log(`App settings:   ${cSetting}`);
  console.log("-".repeat(60));
  console.log(`Total disbursed: ${Number(disbAgg._sum?.amount ?? 0).toLocaleString("en-IN")}`);
  console.log(`Total collected: ${Number(collAgg._sum?.amountPaid ?? 0).toLocaleString("en-IN")}`);
  console.log("-".repeat(60));
  console.log("Credentials:");
  console.log("  ADMIN: admin@pawnify.com / password123  (hidden: hidden123)");
  console.log("  STAFF: priya@pawnify.com / password123");
  console.log("  STAFF: amit@pawnify.com  / password123");
  console.log("=".repeat(60));
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
