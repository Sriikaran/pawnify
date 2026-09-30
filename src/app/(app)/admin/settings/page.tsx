import React from "react";
import { checkAuth } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SettingsPageClient } from "./settings-page-client";

export const metadata = {
  title: "System & LTV Settings | Pawnify Admin",
};

export default async function SettingsPage() {
  const auth = await checkAuth();
  if (!auth.authenticated || auth.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <SettingsPageClient />;
}
