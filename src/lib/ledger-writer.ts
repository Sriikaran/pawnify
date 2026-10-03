/**
 * Ledger Writer — Phase 7
 *
 * A thin wrapper around LedgerEntry creation that supports optional account
 * association via AccountMaster.
 *
 * DESIGN RULES (NON-NEGOTIABLE):
 * - One LedgerEntry per business event (single-entry, single-book model preserved)
 * - Does NOT calculate financial amounts — all amounts are passed in from domain services
 * - Does NOT create debit/credit pairs
 * - Does NOT modify the payment waterfall or interest engine
 * - Does NOT store running balances
 * - accountId is ALWAYS optional — historical NULL entries remain valid
 * - When accountId is provided, validates account exists and is active
 * - Works inside an existing Prisma transaction (tx) OR standalone
 *
 * LedgerEntry field semantics (preserved exactly from prior phases):
 *   amount        — the true 100% monetary amount of the event (DB stores 100% always)
 *   principalAfter — the true 100% principal outstanding after this event
 *   type          — the business event classification (DISBURSEMENT/PAYMENT/CLOSURE/ITEM_RELEASE)
 *   loanId        — the loan this entry belongs to
 *   accountId     — optional link to AccountMaster (nullable, no retroactive assignment)
 *   referenceId   — optional link to Payment record (for PAYMENT type)
 *   description   — human-readable audit string
 *
 * Account mapping decisions (Phase 7):
 *   DISBURSEMENT  → UNRESOLVED — no definitive mapping established; accountId remains nullable
 *   PAYMENT       → UNRESOLVED — no definitive mapping established; accountId remains nullable
 *   CLOSURE       → UNRESOLVED — administrative event (amount=0); accountId remains nullable
 *   ITEM_RELEASE  → UNRESOLVED — operational event (amount=0); accountId remains nullable
 *
 * Passing accountId is supported but not required. Callers may attach an account
 * when the mapping is established by future business decisions.
 */

import { Prisma, TransactionType } from "@prisma/client";
import { validateAccountForPosting } from "@/lib/services/accounts";

export interface WriteLedgerEntryInput {
  loanId: string;
  type: TransactionType;
  amount: Prisma.Decimal;
  principalAfter: Prisma.Decimal;
  description: string;
  referenceId?: string;
  /** Optional AccountMaster link. When provided, account must exist and be ACTIVE. */
  accountId?: string | null;
}

type TxClient = Prisma.TransactionClient;

/**
 * Write a single LedgerEntry, optionally linked to an AccountMaster account.
 *
 * @param tx    A Prisma transaction client (pass `prisma` for standalone execution)
 * @param input The ledger entry fields
 * @returns     The created LedgerEntry record
 *
 * @throws When accountId is provided but the account does not exist or is inactive
 */
export async function writeLedgerEntry(
  tx: TxClient | typeof import("@/lib/db").prisma,
  input: WriteLedgerEntryInput
) {
  // Validate account only if accountId is explicitly supplied
  if (input.accountId) {
    // validateAccountForPosting uses prisma (not tx) internally.
    // This is acceptable: account metadata does not change within payment transactions.
    await validateAccountForPosting(input.accountId);
  }

  const data: Prisma.LedgerEntryCreateInput = {
    loan: { connect: { id: input.loanId } },
    type: input.type,
    amount: input.amount,
    principalAfter: input.principalAfter,
    description: input.description,
    ...(input.referenceId !== undefined && { referenceId: input.referenceId }),
    ...(input.accountId && { account: { connect: { id: input.accountId } } }),
  };

  // tx has the same shape as prisma for ledgerEntry.create
  return await (tx as TxClient).ledgerEntry.create({ data });
}
