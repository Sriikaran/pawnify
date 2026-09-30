import { api } from "./baseApi";
import {
  getSettingsAction,
  saveSettingsAction,
  fetchLiveSpotRatesAction,
} from "@/app/(app)/admin/settings/actions";

export type SettingsResult = Awaited<ReturnType<typeof getSettingsAction>>;
export type FetchLiveSpotRatesResult = Awaited<ReturnType<typeof fetchLiveSpotRatesAction>>;

export const settingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query<SettingsResult, void>({
      query: () => ({ action: getSettingsAction, args: [] }),
      providesTags: ["Settings"],
    }),

    saveSettings: builder.mutation<{ success: boolean; error?: string }, FormData>({
      query: (formData) => ({ action: saveSettingsAction, args: [formData] }),
      invalidatesTags: ["Settings"],
    }),

    fetchLiveSpotRates: builder.mutation<FetchLiveSpotRatesResult, void>({
      query: () => ({ action: fetchLiveSpotRatesAction, args: [] }),
      invalidatesTags: ["Settings"],
    }),
  }),
});

export const { useGetSettingsQuery, useSaveSettingsMutation, useFetchLiveSpotRatesMutation } =
  settingsApi;
