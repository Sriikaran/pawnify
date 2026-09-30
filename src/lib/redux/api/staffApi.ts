import { api } from "./baseApi";
import {
  getStaffListAction,
  createStaffUserAction,
  updateStaffStatusAction,
  updateStaffUserAction,
  deleteStaffUserAction,
} from "@/app/(app)/admin/staff/actions";

export type StaffListResult = Awaited<ReturnType<typeof getStaffListAction>>;

interface CreateStaffUserInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  hiddenPassword?: string;
  role: "ADMIN" | "STAFF";
}

interface UpdateStaffUserData {
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
}

export const staffApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStaffList: builder.query<StaffListResult, void>({
      query: () => ({ action: getStaffListAction, args: [] }),
      providesTags: [{ type: "Staff", id: "LIST" }],
    }),

    createStaffUser: builder.mutation<{ success: boolean; error?: string }, CreateStaffUserInput>({
      query: (formData) => ({ action: createStaffUserAction, args: [formData] }),
      invalidatesTags: [{ type: "Staff", id: "LIST" }],
    }),

    updateStaffStatus: builder.mutation<
      { success: boolean; error?: string },
      { userId: string; isActive: boolean }
    >({
      query: ({ userId, isActive }) => ({
        action: updateStaffStatusAction,
        args: [userId, isActive],
      }),
      invalidatesTags: [{ type: "Staff", id: "LIST" }],
    }),

    updateStaffUser: builder.mutation<
      { success: boolean; error?: string },
      { userId: string; data: UpdateStaffUserData }
    >({
      query: ({ userId, data }) => ({ action: updateStaffUserAction, args: [userId, data] }),
      invalidatesTags: [{ type: "Staff", id: "LIST" }],
    }),

    deleteStaffUser: builder.mutation<{ success: boolean; error?: string }, string>({
      query: (userId) => ({ action: deleteStaffUserAction, args: [userId] }),
      invalidatesTags: [{ type: "Staff", id: "LIST" }],
    }),
  }),
});

export const {
  useGetStaffListQuery,
  useCreateStaffUserMutation,
  useUpdateStaffStatusMutation,
  useUpdateStaffUserMutation,
  useDeleteStaffUserMutation,
} = staffApi;
