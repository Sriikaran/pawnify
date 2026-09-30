/**
 * Account Master Service — Phase 6
 *
 * Provides master data management for financial accounts used by:
 * - Day Book
 * - Account Ledger
 * - Accounting reports & summaries
 *
 * Rules:
 * - Code is uppercase and unique
 * - Name is unique (case-insensitive) to prevent operator confusion
 * - Inactive accounts cannot be used for new transactions
 * - No monetary calculations or balances are stored in Account Master
 * - Pure master/metadata layer
 */

import { prisma } from "@/lib/db";
import { Prisma, AccountType } from "@prisma/client";
import {
  CreateAccountInput,
  CreateAccountSchema,
  UpdateAccountInput,
  UpdateAccountSchema,
  AccountFilter,
} from "@/lib/validation/account";

export interface AccountMasterWithCreator {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  isActive: boolean;
  description: string | null;
  createdById: string | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new account in Account Master.
 *
 * @param input Validated creation data
 * @param createdById User ID of the admin creating this account
 */
export async function createAccount(
  input: CreateAccountInput,
  createdById?: string
): Promise<AccountMasterWithCreator> {
  const parsed = CreateAccountSchema.parse(input);

  // 1. Check duplicate code (case-insensitive)
  const existingCode = await prisma.accountMaster.findFirst({
    where: {
      code: {
        equals: parsed.code,
        mode: "insensitive",
      },
    },
  });

  if (existingCode) {
    throw new Error(`Account code "${parsed.code}" already exists.`);
  }

  // 2. Check duplicate name (case-insensitive)
  const existingName = await prisma.accountMaster.findFirst({
    where: {
      name: {
        equals: parsed.name,
        mode: "insensitive",
      },
    },
  });

  if (existingName) {
    throw new Error(`Account with name "${parsed.name}" already exists.`);
  }

  // 3. Create account
  return await prisma.accountMaster.create({
    data: {
      code: parsed.code,
      name: parsed.name,
      type: parsed.type,
      description: parsed.description,
      isActive: parsed.isActive,
      createdById: createdById ?? null,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * Update an existing account in Account Master.
 * Note: `code` is immutable to preserve audit integrity.
 */
export async function updateAccount(
  id: string,
  input: UpdateAccountInput
): Promise<AccountMasterWithCreator> {
  const parsed = UpdateAccountSchema.parse(input);

  const existing = await prisma.accountMaster.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("Account not found.");
  }

  // If name is updated, check uniqueness against other accounts
  if (parsed.name && parsed.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicateName = await prisma.accountMaster.findFirst({
      where: {
        name: {
          equals: parsed.name,
          mode: "insensitive",
        },
        id: { not: id },
      },
    });

    if (duplicateName) {
      throw new Error(`Account with name "${parsed.name}" already exists.`);
    }
  }

  return await prisma.accountMaster.update({
    where: { id },
    data: {
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.type !== undefined && { type: parsed.type }),
      ...(parsed.description !== undefined && { description: parsed.description }),
      ...(parsed.isActive !== undefined && { isActive: parsed.isActive }),
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * Activate or deactivate an account.
 */
export async function toggleAccountStatus(
  id: string,
  isActive: boolean
): Promise<AccountMasterWithCreator> {
  const existing = await prisma.accountMaster.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("Account not found.");
  }

  return await prisma.accountMaster.update({
    where: { id },
    data: { isActive },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * Get account by unique ID.
 */
export async function getAccountById(
  id: string
): Promise<AccountMasterWithCreator | null> {
  return await prisma.accountMaster.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * Get account by unique code.
 */
export async function getAccountByCode(
  code: string
): Promise<AccountMasterWithCreator | null> {
  return await prisma.accountMaster.findFirst({
    where: {
      code: {
        equals: code.trim(),
        mode: "insensitive",
      },
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * List accounts with optional filters and search.
 */
export async function listAccounts(
  filter?: AccountFilter
): Promise<AccountMasterWithCreator[]> {
  const where: Prisma.AccountMasterWhereInput = {};

  if (filter?.type) {
    where.type = filter.type;
  }

  if (filter?.isActive !== undefined) {
    where.isActive = filter.isActive;
  }

  if (filter?.search) {
    const term = filter.search.trim();
    if (term) {
      where.OR = [
        { code: { contains: term, mode: "insensitive" } },
        { name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }
  }

  return await prisma.accountMaster.findMany({
    where,
    orderBy: [{ type: "asc" }, { code: "asc" }],
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * Get active accounts for transaction dropdowns.
 */
export async function getActiveAccounts(
  type?: AccountType
): Promise<Array<{ id: string; code: string; name: string; type: AccountType }>> {
  return await prisma.accountMaster.findMany({
    where: {
      isActive: true,
      ...(type && { type }),
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
    orderBy: { code: "asc" },
  });
}

/**
 * Validation guard: Ensures an account exists and is ACTIVE before posting.
 * Throws an explicit error if the account is inactive.
 */
export async function validateAccountForPosting(accountId: string): Promise<AccountMasterWithCreator> {
  const account = await getAccountById(accountId);
  if (!account) {
    throw new Error("Account does not exist.");
  }
  if (!account.isActive) {
    throw new Error(`Account "${account.name}" (${account.code}) is inactive and cannot be used for new transactions.`);
  }
  return account;
}
