/**
 * Payment Validation Schema
 */

import { z } from "zod";

export const paymentSchema = z.object({
  loanId: z.string().min(1, "Loan ID is required"),
  amountPaid: z.coerce.number().gt(0, "Payment amount must be greater than 0"),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CARD"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type PaymentFormInput = z.infer<typeof paymentSchema>;
