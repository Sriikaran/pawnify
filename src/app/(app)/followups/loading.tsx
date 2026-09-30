import React from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function FollowUpsLoading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-up Tasks & Reminders"
        description="Track customer communications, overdue interest recovery calls, and maturity notices."
        action={<Skeleton variant="text" className="w-36 h-9 rounded-xl" />}
      />

      {/* Tabs Skeleton */}
      <div
        className="flex items-center gap-2 pb-4"
        style={{ borderBottom: "1px solid var(--border-primary)" }}
      >
        <Skeleton variant="text" className="w-36 h-8 rounded-xl" />
        <Skeleton variant="text" className="w-40 h-8 rounded-xl" />
      </div>

      {/* Table Skeleton */}
      <div className="glass-card p-4 space-y-4">
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: "var(--border-secondary)" }}
        >
          <Skeleton variant="text" className="w-24 h-5" />
          <Skeleton variant="text" className="w-28 h-5" />
          <Skeleton variant="text" className="w-32 h-5" />
          <Skeleton variant="text" className="w-44 h-5" />
          <Skeleton variant="text" className="w-24 h-5" />
          <Skeleton variant="text" className="w-24 h-5" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-3 border-b"
            style={{ borderColor: "var(--border-secondary)" }}
          >
            <Skeleton variant="text" className="w-24 h-6" />
            <div className="space-y-1">
              <Skeleton variant="text" className="w-28 h-4 font-mono" />
              <Skeleton variant="text" className="w-20 h-3" />
            </div>
            <div className="space-y-1">
              <Skeleton variant="text" className="w-32 h-4" />
              <Skeleton variant="text" className="w-24 h-3 font-mono" />
            </div>
            <Skeleton variant="text" className="w-48 h-4" />
            <Skeleton variant="text" className="w-24 h-4" />
            <div className="flex gap-2 justify-end">
              <Skeleton variant="text" className="w-20 h-7 rounded-lg" />
              <Skeleton variant="text" className="w-8 h-7 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
