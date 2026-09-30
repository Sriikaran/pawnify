"use server";

import { revalidatePath } from "next/cache";
import { checkAuth } from "@/lib/auth/session";
import { createLoan } from "@/lib/services/loans";
import { createLoanSchema } from "@/lib/validation/loan";

export async function createLoanAction(formData: unknown) {
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.user) {
    return { success: false, error: "Unauthorized. Please sign in." };
  }

  const parsed = createLoanSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid loan application data",
    };
  }

  try {
    const loan = await createLoan({
      customerId: parsed.data.customerId,
      handledById: auth.user.id,
      items: parsed.data.items,
      tenureMonths: parsed.data.tenureMonths,
      interestRateMonthly: parsed.data.interestRateMonthly,
      principalAmount: parsed.data.principalAmount,
      gracePeriodDays: parsed.data.gracePeriodDays,
      processingFee: parsed.data.processingFee,
    });

    revalidatePath("/loans");
    revalidatePath("/dashboard");
    revalidatePath(`/customers/${parsed.data.customerId}`);
    return { success: true, loanId: loan.id };
  } catch (err: unknown) {
    console.error("Failed to create loan:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to disburse loan",
    };
  }
}
