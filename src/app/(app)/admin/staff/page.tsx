import React from "react";
import { checkAuth } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { StaffManagementClient } from "./staff-management-client";

export const metadata = {
  title: "Staff & User Management | Pawnify Admin",
};

export default async function StaffManagementPage() {
  const auth = await checkAuth();
  if (!auth.authenticated || auth.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <StaffManagementClient />;
}
