"use client";

import React from "react";
import { PageHeader } from "@/components/page-header";
import { AddStaffModal } from "./staff-client";
import { StaffTable, StaffRowData } from "./staff-table";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApi";

export function StaffManagementClient() {
  const { data, isFetching } = useGetStaffListQuery();

  const formattedUsers: StaffRowData[] = (data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    _count: {
      loansHandled: u._count.loansHandled,
      paymentsCollected: u._count.paymentsCollected,
    },
    createdAt: u.createdAt,
    isSelf: u.isSelf,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & User Management"
        description="Create institutional staff credentials, assign branch vault roles, and manage active system access."
        action={<AddStaffModal />}
      />

      <StaffTable data={formattedUsers} isLoading={isFetching} />
    </div>
  );
}
