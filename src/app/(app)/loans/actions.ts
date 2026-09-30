"use server";

import { checkAuth } from "@/lib/auth/session";
import { getLoans, type LoanFilters } from "@/lib/services/loans";
import { serializeForClient } from "@/lib/serialize";
import { projectLoansList } from "@/lib/projection";

export async function getLoansListAction(filters: LoanFilters) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }
  const result = await getLoans(filters);
  const projectedResult = projectLoansList(result, auth.calculationMode);
  return serializeForClient(projectedResult);
}
