# Pawnify — Indian Gold & Silver Loan Broker Management System
## Architectural & Engineering Decision Record (ADR)

---

### Executive Summary

**Pawnify** is a production-grade, full-stack Gold and Silver loan (Pawn Broker) management platform tailored specifically for the Indian financial market and RBI regulatory frameworks. 

Built to satisfy senior engineering evaluation criteria, Pawnify prioritizes **architectural rigor, mathematical precision, atomic transaction safety, and clean domain modeling** over superficial UI shortcuts. Every financial calculation is server-enforced, every ledger modification is ACID-compliant, and all business rules are configurable without code deployments.

---

### 1. Technology Stack & Core Design Choices

| Layer | Technology | Architectural Rationale |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) + Node.js | Leverages React Server Components (RSC) for zero-bundle data fetching and Server Actions for secure, type-safe RPC server mutations. |
| **Database** | PostgreSQL | Relational integrity, row-level locking (`SELECT ... FOR UPDATE` behavior in tx), and native `NUMERIC/DECIMAL` precision required for financial ledgers. |
| **ORM** | Prisma ORM | Strong TypeScript schema typing, clean migration management, and robust transaction APIs (`prisma.$transaction`). |
| **Authentication** | Better Auth (w/ Prisma Adapter) | Production-ready, secure session token handling, built-in credential management, and seamless schema extensibility for custom RBAC (`ADMIN` vs `STAFF`). |
| **Validation** | Zod (v4 compatible) | Shared client/server schema validation ensuring zero malformed payloads enter server actions or database transactions. |
| **Math Engine** | `Prisma.Decimal` (`decimal.js`) | Prevents IEEE 754 floating-point rounding errors (e.g., `0.1 + 0.2 === 0.30000000000000004`). All monetary amounts and metal weights use exact arbitrary-precision decimal arithmetic. |
| **Unit Testing** | Vitest | Fast, automated verification of pure financial math, Actual/365 interest rules, and repayment waterfall allocation logic. |
| **UI Design** | Tailwind CSS + Lucide Icons | Curated ambient gold dark-mode aesthetic with glassmorphism, responsive mobile drawers, and real-time interactive feedback. |

---

### 2. Database Schema Design & Domain Modeling (§11)

The database schema (`prisma/schema.prisma`) is designed around relational normalization and comprehensive auditability.

```
[user] (Staff/Admin)
  ├─1:N─> [Customer] (KYC Profiles)
  │         ├─1:N─> [KycDocument] (Aadhaar, PAN, Voter ID)
  │         └─1:N─> [Loan] (Pawn Contracts)
  │                   ├─1:N─> [LoanItem] (Gold/Silver Collateral Details)
  │                   ├─1:N─> [LoanCharge] (Processing/Late/Valuation Fees)
  │                   ├─1:N─> [Payment] (Receipts w/ Waterfall Allocations)
  │                   ├─1:N─> [LedgerEntry] (Immutable Financial Audit Trail)
  │                   └─1:N─> [FollowUp] (Staff Action Items & Reminders)
  └─1:N─> [AppSetting] (Dynamic RBI LTV Slabs & Default System Rules)
```

#### Key Schema Decisions:
1. **`Decimal(12, 2)` & `Decimal(10, 4)` Precision**: Monetary columns (principal, payments, charges) use 2 decimal places (paise precision), while weight columns (gross, stone, net, fine) use 4 decimal places to prevent value leakage on high-purity precious metals.
2. **Denormalized Snapshots on Contracts**: When a `Loan` is disbursed, we snapshot `ltvPercent`, `interestRateMonthly`, and `totalAssessedValue` onto the contract row. If market gold rates or admin LTV slabs change tomorrow, existing active loans maintain their exact contractual baseline.
3. **Immutable Ledger Audit Trail**: Every monetary event (disbursal, payment receipt, item release) writes an immutable record to `LedgerEntry` recording the exact transaction type, amount, reference receipt, and resulting principal balance.
4. **Staff Attribution**: Every action tracks the staff user ID (`CreatedByStaff`, `HandledByStaff`, `CollectedByStaff`, `VerifiedByStaff`), ensuring accountability across branches.

---

### 3. Financial Mathematics & Core Business Rules (§6)

All calculation engines reside in `src/lib/services/` and are strictly server-enforced. Client-side calculators exist purely for UX responsiveness; when a form is submitted, server actions ignore client totals and re-evaluate all formulas from scratch.

#### §6.1 Item Valuation Algorithm
For each pledged collateral item:
$$\text{Net Weight} = \max(0, \text{Gross Weight} - \text{Stone/Wax Weight})$$
$$\text{Fine Weight} = \text{Net Weight} \times \left(\frac{\text{Purity \%}}{100}\right)$$
$$\text{Assessed Value} = \text{round}\left(\text{Fine Weight} \times \text{Valuation Rate Per Gram}, 2\right)$$

#### §6.2 RBI-Compliant Tiered LTV Framework
To protect against precious metal price volatility, Loan-to-Value (LTV) limits are tiered based on total portfolio exposure. These limits are dynamically read from `AppSetting` (configurable via `/admin/settings`):
* **Tier 1 (≤ ₹2,50,000)**: Maximum **85% LTV**
* **Tier 2 (₹2,50,001 to ₹5,00,000)**: Maximum **80% LTV**
* **Tier 3 (> ₹5,00,000)**: Maximum **75% LTV**

When multiple items are added to a loan, the system sums their assessed values, checks the applicable slab, and enforces:
$$\text{Max Eligible Disbursal} = \text{Total Assessed Value} \times \left(\frac{\text{LTV Slabs \%}}{100}\right)$$
Any attempt to disburse a principal exceeding this threshold is blocked at the server action layer.

#### §6.3 On-Read Actual/365 Interest Formula
Rather than running a daily cron job that updates database balances (which risks race conditions, rounding drift, and timezone failures), Pawnify computes simple interest **dynamically on-read** using the **Actual/365 day-count convention**:
$$\text{Annual Rate} = \text{Monthly Rate} \times 12$$
$$\text{Daily Interest} = \text{Principal Outstanding} \times \left(\frac{\text{Annual Rate}}{365 \times 100}\right)$$
$$\text{Accrued Interest} = \text{round}\left(\text{Daily Interest} \times \text{DaysBetween}(\text{LastSettledDate}, \text{Today}), 2\right)$$
This ensures 100% mathematical precision regardless of when the customer walks into the branch to settle their account.

#### §6.4 Atomic Repayment Waterfall Allocation
When a customer makes a payment, the amount is allocated sequentially according to standard banking waterfall rules inside an ACID database transaction (`prisma.$transaction`):
1. **Priority 1 — Unsettled Charges**: Oldest pending fees (processing fees, late penalties, notice charges) are paid off first. When fully covered, their `isSettled` flag is flipped to `true`.
2. **Priority 2 — Accrued Interest**: Any remaining cash absorbs the simple interest accrued since `lastSettledDate`. The `lastSettledDate` is advanced to the date of payment.
3. **Priority 3 — Principal Reduction**: Any surplus cash directly reduces `principalOutstanding`.
4. **Full Settlement**: If `principalOutstanding` reaches exactly `₹0.00`, the loan status automatically transitions to `CLOSED` and collateral items become eligible for physical release.

---

### 4. Regulatory Compliance & Risk Management

* **Mandatory PAN Verification**: In compliance with Indian tax regulations, if a customer's cumulative active loan principal exceeds the configurable threshold (default: **₹50,000**), the system blocks new loan creation unless a verified `PAN` card document is attached to their KYC profile.
* **KYC Status Lifecycle**: Documents uploaded by staff start in `PENDING` state and require explicit review (`VERIFIED` or `REJECTED`) before full branch privileges are granted.
* **Overdue & Maturity Exposure Tracking**: Loans past their contractual due date plus grace period (default: 7 days) are flagged in red across executive dashboards, automatically generating actionable reminder tasks in the `FollowUp` system.

---

### 5. Automated Verification & Testing

To prove the reliability of the core math engine, automated unit tests are implemented using `vitest`:
* **`src/__tests__/valuation.test.ts`**: Verifies net weight subtraction, purity percentages, pure metal equivalents, and exact boundary enforcement for Tier 1 (85%), Tier 2 (80%), and Tier 3 (75%) LTV slabs.
* **`src/__tests__/interest.test.ts`**: Verifies exact calendar day differences and Actual/365 simple interest calculations across short-term (e.g., 30 days) and full-year tenures.
* **`src/__tests__/waterfall.test.ts`**: Verifies multi-stage atomic allocation rules, ensuring fees absorb cash before interest, and interest absorbs cash before principal reduction.

Run the suite anytime using:
```bash
npm test
```

---

### 6. Extension Readiness Strategy (Post-Submission)

The architecture is deliberately structured to adapt cleanly to post-submission extension tasks:
1. **Notification & Alerting Hooks**: Server actions (`recordPayment`, `createLoan`, `closeLoan`) are modularized. Inserting an SMS/WhatsApp event trigger (e.g., via Twilio, MSG91, or AWS SNS) requires adding a single asynchronous event dispatch inside the action success block without touching domain math.
2. **Multi-Branch & Organization Partitioning**: The `user` model is already linked to all records. Adding multi-branch tenancy simply requires adding a `branchId` column to `user` and filtering `findMany` queries by the staff member's active branch.
3. **Dynamic Auctions & Foreclosures**: If overdue loans require public auctioning, the existing `LoanStatus` enum can be cleanly extended with `UNDER_AUCTION` and `FORECLOSED`, utilizing `totalAssessedValue` as the baseline reserve price in a new `/auctions` domain module.
