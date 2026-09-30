"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "./settings-client";
import { useGetSettingsQuery } from "@/lib/redux/api/settingsApi";

export function SettingsPageClient() {
  const { data, isLoading } = useGetSettingsQuery();

  return (
    <div>
      <PageHeader
        title="System Parameters & RBI LTV Configuration"
        description="Configure regulatory tiered LTV caps, default monthly simple interest rates, grace periods, and KYC thresholds."
      />

      {isLoading || !data ? (
        <div className="p-12 text-center text-(--text-muted)">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-(--accent)" />
        </div>
      ) : (
        <SettingsForm initialSettings={data} />
      )}
    </div>
  );
}
