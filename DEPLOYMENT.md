# Pawnify Production Deployment Guide (Vercel)

This guide documents the exact procedure to deploy **Pawnify** to [Vercel](https://vercel.com) with PostgreSQL and Better Auth.

---

## 1. System Requirements

- **Node.js**: 20.x or 22.x LTS
- **PostgreSQL**: PostgreSQL 15+ (e.g. Supabase, Neon, AWS RDS, Railway) with connection pooling support
- **Package Manager**: npm (uses `package-lock.json`)
- **Vercel Account**: With access to GitHub integration

---

## 2. Vercel Import Instructions

1. Log into your **Vercel Dashboard**.
2. Click **Add New...** → **Project**.
3. Import the repository: `https://github.com/Sriikaran/pawnify`.
4. Keep the Framework Preset as **Next.js**.
5. Keep the Root Directory as `./`.
6. Verify Build and Output Settings:
   - **Build Command**: `prisma generate && next build` (detected automatically from `package.json`)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` or `npm ci` (default)
7. Configure the Environment Variables (see Section 3 below).
8. Click **Deploy**.

---

## 3. Environment Variables Contract

Add the following variables in Vercel under **Settings → Environment Variables**:

| Variable Name | Required | Target Environments | Secret / Public | Purpose | Example Placeholder |
|---|---|---|---|---|---|
| `DATABASE_URL` | **Yes** | Production, Preview, Development | Server-only (Secret) | Pooled PostgreSQL connection string for serverless runtime | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | **Yes** | Production, Preview, Development | Server-only (Secret) | Direct PostgreSQL connection string for Prisma CLI operations | `postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres` |
| `BETTER_AUTH_SECRET` | **Yes** | Production, Preview | Server-only (Secret) | High-entropy random secret key (min 32 chars) for session tokens | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | **Yes** | Production | Server-only | Canonical public URL of the deployed application | `https://pawnify.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Production | Public | Client-side public base URL for metadataBase & client auth | `https://pawnify.vercel.app` |
| `CRON_SECRET` | **Yes** | Production | Server-only (Secret) | Bearer token for Vercel Cron `/api/cron/update-rates` | `your-cron-auth-token` |
| `DB_POOL_MAX` | No | Production | Server-only | Maximum pool connections per serverless container (default: 10) | `10` |
| `DEBUG` | No | Production, Preview | Server-only | Enable verbose calculation logging in logs (default: false) | `false` |

---

## 4. Production Database Initialization

Before deploying or upon provisioning a fresh PostgreSQL database:

1. In your local terminal, export your production `DIRECT_URL`:
   ```bash
   export DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
   export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
   ```
2. Push the schema to create tables and indexes without resetting or dropping data:
   ```bash
   npx prisma db push
   ```
   *Note: `prisma db reset` or `--force-reset` is strictly forbidden in production.*

---

## 5. First Admin User Bootstrap Procedure

A fresh production database has no users. Do NOT run development seed scripts that create dummy loans or test customers.

To bootstrap the first **ADMIN** user safely:
1. Ensure your local environment is configured with the production `DATABASE_URL` and `DIRECT_URL`.
2. Run the dedicated interactive admin bootstrap script or run:
   ```bash
   npx tsx scripts/bootstrap-admin.ts
   ```
   Or insert the first admin user via Better Auth CLI / direct secure script.
3. Once created, login at `/login` with the admin mobile number and password.

---

## 6. Build & Verification Commands

To verify locally before any deployment:
```bash
# 1. Generate Prisma Client
npm run db:generate

# 2. Typecheck
npx tsc --noEmit

# 3. Lint
npm run lint

# 4. Run Automated Test Suite (234/234 passing)
npm test

# 5. Production Build
npm run build
```

---

## 7. Production Verification Checklist

After Vercel finishes deploying:

- [ ] Visit `https://your-deployment.vercel.app/login` — verify the login page loads cleanly.
- [ ] Test **Normal Password Login** with an ADMIN account — verify session mode is `NORMAL`.
- [ ] Test **Hidden Password Login** with the dual-password account — verify session mode is `FIFTY_PERCENT`.
- [ ] Verify Dashboard metrics display accurately.
- [ ] Verify Loans list, Customer list, Day Book, and Account Ledger render without errors.
- [ ] Test creating a loan and posting a payment; verify the payment waterfall settles charges, then interest, then principal.
- [ ] Test Logout to ensure session cookie is invalidated.
- [ ] Test STAFF account cannot access `/admin/*` routes (enforced by RBAC).

---

## 8. Troubleshooting Common Deployment Failures

1. **Prisma Client not found / P2021 error**:
   - Verify `prisma generate` is part of the build command (`"build": "prisma generate && next build"`).
2. **Dynamic Server Usage / Headers Error**:
   - Normal in Next.js App Router for authenticated routes. Next.js marks routes dynamic (`ƒ`) automatically.
3. **Database Connection Limit Exceeded**:
   - Ensure `DATABASE_URL` uses the pooled connection string (port 6543 with `?pgbouncer=true` on Supabase). Do NOT connect directly to port 5432 for high serverless concurrency.
4. **Invalid Redirect / Origin Mismatch on Auth**:
   - Check that `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` match your exact Vercel production domain (e.g. `https://pawnify.vercel.app`), without trailing slashes.
