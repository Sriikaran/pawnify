# Pawnify — Indian Gold & Silver Loan Broker Management System
**Senior Full-Stack Engineering Deliverable**

---

### Overview

**Pawnify** is a production-ready, full-stack Gold & Silver loan (Pawn Broker) management platform tailored for the Indian financial market. Built with **Next.js 16 (App Router)**, **Node.js**, **PostgreSQL**, **Prisma ORM**, and **Better Auth**, it models complex financial workflows with mathematical precision, ACID transaction safety, and comprehensive regulatory compliance.

> **Note for Evaluators**: Please read [ARCHITECTURE.md](file:///e:/projects/pawnify/ARCHITECTURE.md) for a detailed breakdown of our database schema design, decimal arithmetic precision, RBI tiered Loan-to-Value (LTV) rules, on-read Actual/365 interest algorithms, and atomic repayment waterfall allocation rules.

---

### Key Features & Capabilities

* **Interactive Evaluator 1-Click Login**: Instant access to pre-seeded Admin and Branch Staff accounts without typing credentials.
* **Executive KPI Dashboard**: Real-time tracking of Assets Under Management (AUM), daily cash/UPI collections, overdue exposure alerts, and quick actions.
* **Customer & KYC Management**: Indian mobile number formatting, state dropdowns, multi-document KYC attachments (Aadhaar, PAN, Voter ID) with masking, and interactive 1-click verify/reject workflows.
* **Regulatory PAN Enforcement**: Automatic blocking of loan disbursals if active exposure exceeds **₹50,000** without a verified PAN card.
* **Pawn Contract & Collateral Builder**: Multi-item collateral entry (Gold & Silver) with auto-calculation of net weight and pure metal equivalent (e.g., 22K → 91.6%).
* **RBI-Compliant Tiered LTV Slabs**: Server-enforced disbursal caps based on total assessed valuation (≤ ₹2.5L: 85%, ₹2.5L–₹5L: 80%, > ₹5L: 75%).
* **Actual/365 Simple Interest Engine**: Zero-drift dynamic interest computation on-read, eliminating background cron job rounding errors.
* **Atomic Repayment Waterfall**: Sequential settlement of Unsettled Charges → Accrued Interest → Principal inside strict database transactions (`prisma.$transaction`).
* **Gen-Z Neo-Fintech UI & Typography**: Ultra-modern obsidian dark mode powered by **Poppins** typography, glassmorphism card layouts, vibrant neon gold/emerald/rose badges, and celebratory **confetti micro-animations** upon successful loan closures and repayment settlements.
* **Interactive Recharts Visualizations**: Dynamic multi-tab graphical dashboard displaying 6-month disbursement vs. collection cashflow trends and real-time Gold vs. Silver collateral portfolio composition.
* **Staff Action Items & Follow-ups**: Tabbed task tracker for overdue recovery calls and maturity notices with status toggles.
* **Regulatory Analytics & Reports**: Visual breakdown of LTV exposure tiers, Gold vs Silver collateral distribution, and collections revenue.
* **Admin Role & Settings Management**: RBAC provisioning for new staff members, account deactivation, and real-time editing of system LTV percentages and interest defaults.

---

### Quickstart Setup Guide

#### 1. Prerequisites
* **Node.js** (v20+ recommended)
* **PostgreSQL / Supabase** (v14+ database)

#### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd pawnify
npm install
```

#### 3. Environment Configuration
Create a `.env` file in the project root with your database connection string and Better Auth secret:
```env
DATABASE_URL="postgresql://user:password@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
BETTER_AUTH_SECRET="a-random-32-character-secret-key-for-production-security-1234567"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

#### 4. Database Setup & Seeding
Push the Prisma schema to your database and run the comprehensive demo data seed script using our helper commands:
```bash
# Push database schema & seed demo data in one command
npm run db:reset

# Or run individually:
npm run db:push
npm run db:seed
```
*(Note: Seeding automatically creates Admin/Staff accounts, 8 demo customers with verified KYC, 13 active/overdue/closed pawn loans, repayment histories, and default system settings)*

#### 5. Running the Application
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. You will be redirected to the login page where you can use the **1-click evaluator demo buttons**.

---

### Demo Credentials (Pre-Seeded)

| Role | Email | Password | Privileges |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@pawnify.com` | `password123` | Full system access, staff management, LTV/settings configuration. |
| **Staff 1** | `staff@pawnify.com` | `password123` | Can register customers, disburse loans, record payments, verify KYC. |
| **Staff 2** | `priya@pawnify.com` | `password123` | Branch staff user for multi-user activity testing. |

---

### Running Automated Verification Tests

Pawnify includes a fast automated unit test suite (`vitest`) verifying our core financial algorithms, LTV boundary checks, Actual/365 interest math, and repayment waterfall allocation logic:
```bash
npm test
```

---

### Project Structure & Code Navigation

```
pawnify/
├── prisma/
│   ├── schema.prisma       # PostgreSQL relational schema & Better Auth tables
│   └── seed.ts             # Comprehensive demo data generator (§11)
├── src/
│   ├── __tests__/          # Vitest automated unit test suites
│   ├── app/
│   │   ├── (auth)/login/   # Glassmorphic login page w/ 1-click evaluator fill buttons
│   │   ├── (app)/          # Protected app layout w/ responsive sidebar drawer
│   │   │   ├── dashboard/  # Executive KPI dashboard w/ overdue attention table
│   │   │   ├── customers/  # Customer catalog, KYC upload & verification workflows
│   │   │   ├── loans/      # Loan contracts, multi-item builder, repayment waterfall modal
│   │   │   ├── followups/  # Staff task tracker & reminder schedules
│   │   │   ├── reports/    # RBI LTV exposure tiers & collateral composition analytics
│   │   │   └── admin/      # RBAC staff management & system LTV parameter editing
│   │   └── api/            # Server endpoints (typeahead customer search, system health)
│   ├── components/         # Reusable UI components (Sidebar, PageHeader, Modals)
│   └── lib/
│       ├── auth/           # Better Auth server configuration & session verification
│       ├── services/       # Core business engines (Valuation, Interest, Payments, Loans)
│       └── validation/     # Zod shared client/server input validation schemas
├── ARCHITECTURE.md         # In-depth architectural & financial math ADR
└── vitest.config.ts        # Unit test framework configuration
```
