import React from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoansLoading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan Contracts Directory"
        description="Monitor gold & silver pledges, track outstanding principal, check LTV ratios, and process repayments."
        action={<Skeleton variant="text" className="w-36 h-9 rounded-xl" />}
      />

      {/* Status Filter Tabs Skeleton */}
      <div
        className="flex flex-wrap items-center gap-2 pb-4"
        style={{ borderBottom: "1px solid var(--border-primary)" }}
      >
        <Skeleton variant="text" className="w-24 h-8 rounded-xl" />
        <Skeleton variant="text" className="w-20 h-8 rounded-xl" />
        <Skeleton variant="text" className="w-32 h-8 rounded-xl" />
        <Skeleton variant="text" className="w-28 h-8 rounded-xl" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Skeleton variant="text" className="w-72 h-9 rounded-xl" />
          <Skeleton variant="text" className="w-44 h-9 rounded-xl" />
          <Skeleton variant="text" className="w-16 h-9 rounded-xl" />
        </div>
        <Skeleton variant="text" className="w-32 h-5" />
      </div>

      {/* Table Skeleton */}
      <div className="glass-card p-4 space-y-4">
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: "var(--border-secondary)" }}
        >
          <Skeleton variant="text" className="w-24 h-5" />
          <Skeleton variant="text" className="w-32 h-5" />
          <Skeleton variant="text" className="w-28 h-5" />
          <Skeleton variant="text" className="w-24 h-5" />
          <Skeleton variant="text" className="w-24 h-5" />
          <Skeleton variant="text" className="w-20 h-5" />
          <Skeleton variant="text" className="w-16 h-5" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-3 border-b"
            style={{ borderColor: "var(--border-secondary)" }}
          >
            <Skeleton variant="text" className="w-28 h-8" />
            <Skeleton variant="text" className="w-36 h-8" />
            <Skeleton variant="text" className="w-32 h-8" />
            <Skeleton variant="text" className="w-28 h-8" />
            <Skeleton variant="text" className="w-28 h-8" />
            <Skeleton variant="text" className="w-20 h-6 rounded-full" />
            <Skeleton variant="text" className="w-16 h-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
