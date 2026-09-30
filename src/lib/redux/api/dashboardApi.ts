import { api } from "./baseApi";
import { getDashboardDataAction } from "@/app/(app)/dashboard/actions";
import type { DashboardFilter } from "@/lib/services/dashboard";

export type DashboardData = Awaited<ReturnType<typeof getDashboardDataAction>>;

export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardData: builder.query<DashboardData, DashboardFilter | void>({
      query: (filter) => ({ action: getDashboardDataAction, args: filter ? [filter] : [] }),
      providesTags: ["Dashboard"],
    }),
  }),
});

export const { useGetDashboardDataQuery } = dashboardApi;
