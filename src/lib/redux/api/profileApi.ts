import { api } from "./baseApi";
import { updateProfileNameAction, updateProfileAvatarAction } from "@/app/(app)/profile/actions";

export const profileApi = api.injectEndpoints({
  endpoints: (builder) => ({
    updateProfileName: builder.mutation<{ success: boolean; error?: string }, FormData>({
      query: (formData) => ({ action: updateProfileNameAction, args: [formData] }),
      invalidatesTags: ["Profile", "Dashboard"],
    }),

    updateProfileAvatar: builder.mutation<{ success: boolean; error?: string }, string>({
      query: (avatarUrl) => ({ action: updateProfileAvatarAction, args: [avatarUrl] }),
      invalidatesTags: ["Profile", "Dashboard"],
    }),
  }),
});

export const { useUpdateProfileNameMutation, useUpdateProfileAvatarMutation } = profileApi;
