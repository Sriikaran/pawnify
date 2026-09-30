import { z } from "zod";

export const AccountTypeEnum = z.enum([
  "ASSET",
  "LIABILITY",
  "INCOME",
  "EXPENSE",
  "EQUITY",
]);
export type AccountType = z.infer<typeof AccountTypeEnum>;

/**
 * Validation schema for creating a new Account Master entry.
 *
 * Rules:
 * - Code: 2-30 characters, alphanumeric with hyphens/underscores, will be stored uppercase
 * - Name: 2-100 characters, trimmed
 * - Type: One of ASSET, LIABILITY, INCOME, EXPENSE, EQUITY
 * - Description: Optional, up to 255 characters
 * - IsActive: Optional boolean, defaults to true
 */
export const CreateAccountSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Account code must be at least 2 characters")
    .max(30, "Account code cannot exceed 30 characters")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Account code must contain only letters, numbers, hyphens, and underscores"
    )
    .transform((v) => v.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, "Account name must be at least 2 characters")
    .max(100, "Account name cannot exceed 100 characters"),
  type: AccountTypeEnum,
  description: z
    .string()
    .trim()
    .max(255, "Description cannot exceed 255 characters")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  isActive: z.boolean().default(true),
});

export type CreateAccountInput = z.input<typeof CreateAccountSchema>;
export type CreateAccountOutput = z.output<typeof CreateAccountSchema>;

/**
 * Validation schema for updating an existing Account Master entry.
 *
 * Note: `code` is immutable once created to preserve historical integrity.
 */
export const UpdateAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Account name must be at least 2 characters")
    .max(100, "Account name cannot exceed 100 characters")
    .optional(),
  type: AccountTypeEnum.optional(),
  description: z
    .string()
    .trim()
    .max(255, "Description cannot exceed 255 characters")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  isActive: z.boolean().optional(),
});

export type UpdateAccountInput = z.input<typeof UpdateAccountSchema>;
export type UpdateAccountOutput = z.output<typeof UpdateAccountSchema>;

/**
 * Filter schema for querying accounts.
 */
export const AccountFilterSchema = z.object({
  type: AccountTypeEnum.optional(),
  isActive: z.boolean().optional(),
  search: z.string().trim().optional(),
});

export type AccountFilter = z.infer<typeof AccountFilterSchema>;
