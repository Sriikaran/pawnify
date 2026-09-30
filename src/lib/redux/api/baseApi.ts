import { createApi } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query/react";

/**
 * Server actions are already the app's RPC layer (auth-checked, "use server"
 * functions) — this baseQuery calls them directly instead of going through
 * fetch()/REST, so RTK Query gets caching/invalidation without duplicating
 * every read/write as an API route.
 */
type ServerActionArgs = {
  // Concrete server-action signatures (e.g. (id: string) => ...) aren't assignable to a
  // (...args: unknown[]) shape under contravariant parameter checking; `any` here is what
  // makes every endpoint's specific action function accepted.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (...args: any[]) => Promise<unknown>;
  args?: unknown[];
};

interface ActionErrorShape {
  success: false;
  error: string;
}

function isActionError(data: unknown): data is ActionErrorShape {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    (data as { success: unknown }).success === false
  );
}

const serverActionBaseQuery: BaseQueryFn<ServerActionArgs, unknown, { message: string }> = async ({
  action,
  args = [],
}) => {
  try {
    const data = await action(...args);
    if (isActionError(data)) {
      return { error: { message: data.error } };
    }
    return { data };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : "Request failed" } };
  }
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: serverActionBaseQuery,
  tagTypes: [
    "Loan",
    "LoanList",
    "Customer",
    "CustomerList",
    "Dashboard",
    "Staff",
    "Settings",
    "FollowUp",
    "Report",
    "MarketRate",
    "Profile",
  ],
  endpoints: () => ({}),
});
