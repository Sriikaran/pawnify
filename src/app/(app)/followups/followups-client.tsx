"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { NewFollowUpModal } from "./followup-client";
import { FollowUpsTable, FollowUpRowData } from "./followups-table";
import { useGetFollowUpsQuery } from "@/lib/redux/api/followupsApi";

function FollowUpsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "PENDING";

  const { data, isFetching } = useGetFollowUpsQuery(tab);

  const formattedFollowUps: FollowUpRowData[] = data?.followUps ?? [];
  const activeLoanOptions = data?.activeLoanOptions ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-up Tasks & Reminders"
        description="Track customer communications, overdue interest recovery calls, and maturity notices."
        action={<NewFollowUpModal loans={activeLoanOptions} />}
      />

      {/* Tabs */}
      <div
        className="flex items-center gap-2 pb-4"
        style={{ borderBottom: "1px solid var(--border-primary)" }}
      >
        <Link
          href="/followups?tab=PENDING"
          className="px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          style={
            tab === "PENDING"
              ? {
                  background: "var(--accent)",
                  color: "var(--text-inverse)",
                  boxShadow: "0 4px 12px -2px rgba(34, 197, 94, 0.3)",
                }
              : {
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-primary)",
                }
          }
        >
          Pending Action Items
        </Link>
        <Link
          href="/followups?tab=DONE"
          className="px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          style={
            tab === "DONE"
              ? {
                  background: "var(--accent)",
                  color: "var(--text-inverse)",
                  boxShadow: "0 4px 12px -2px rgba(34, 197, 94, 0.3)",
                }
              : {
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-primary)",
                }
          }
        >
          Completed Reminders
        </Link>
      </div>

      {/* TanStack Table */}
      <FollowUpsTable data={formattedFollowUps} tab={tab} isLoading={isFetching} />
    </div>
  );
}

export function FollowUpsClient() {
  return (
    <Suspense fallback={null}>
      <FollowUpsContent />
    </Suspense>
  );
}
