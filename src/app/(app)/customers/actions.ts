"use server";

import { checkAuth } from "@/lib/auth/session";
import { getCustomers, type CustomerFilters } from "@/lib/services/customers";
import { serializeForClient } from "@/lib/serialize";

export async function getCustomersListAction(filters: CustomerFilters) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }
  return serializeForClient(await getCustomers(filters));
}
