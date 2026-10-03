"use server";

import { revalidatePath } from "next/cache";
import { checkAuth } from "@/lib/auth/session";
import { createLoan } from "@/lib/services/loans";
import { createLoanSchema } from "@/lib/validation/loan";
import { invertMonetaryInputNumber } from "@/lib/projection";

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
    // Convert halved monetary inputs back to true 100% database values if in 50% mode
    const truePrincipal = invertMonetaryInputNumber(
      parsed.data.principalAmount,
      auth.calculationMode
    );
    const trueFee = parsed.data.processingFee
      ? invertMonetaryInputNumber(parsed.data.processingFee, auth.calculationMode)
      : undefined;

    const loan = await createLoan({
      customerId: parsed.data.customerId,
      handledById: auth.user.id,
      items: parsed.data.items,
      tenureMonths: parsed.data.tenureMonths,
      interestRateMonthly: parsed.data.interestRateMonthly,
      principalAmount: truePrincipal,
      gracePeriodDays: parsed.data.gracePeriodDays,
      processingFee: trueFee,
      interestType: parsed.data.interestType,
      interestFrequency: parsed.data.interestFrequency,
      cumulativePeriodMonths: parsed.data.cumulativePeriodMonths,
      interestTreatment: parsed.data.interestTreatment,
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
