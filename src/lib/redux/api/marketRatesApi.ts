import { api } from "./baseApi";
import { getMarketRatesAction } from "@/lib/actions/market-rates-actions";

export type MarketRatesData = Awaited<ReturnType<typeof getMarketRatesAction>>;

export const marketRatesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMarketRates: builder.query<MarketRatesData, void>({
      query: () => ({ action: getMarketRatesAction, args: [] }),
      providesTags: ["MarketRate"],
    }),
  }),
});

export const { useGetMarketRatesQuery } = marketRatesApi;
