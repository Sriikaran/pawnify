import { api } from "./baseApi";
import { getMarketRatesAction } from "@/lib/actions/market-rates-actions";
import { updateMetalRatesAction } from "@/app/(app)/dashboard/actions";

export type MarketRatesData = Awaited<ReturnType<typeof getMarketRatesAction>>;

export const marketRatesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMarketRates: builder.query<MarketRatesData, void>({
      query: () => ({ action: getMarketRatesAction, args: [] }),
      providesTags: ["MarketRate"],
    }),
    updateMarketRates: builder.mutation<
      unknown,
      { goldRate: number | string; silverRate: number | string }
    >({
      query: ({ goldRate, silverRate }) => ({
        action: updateMetalRatesAction,
        args: [goldRate, silverRate],
      }),
      invalidatesTags: ["MarketRate", "Dashboard"],
    }),
  }),
});

export const { useGetMarketRatesQuery, useUpdateMarketRatesMutation } = marketRatesApi;
