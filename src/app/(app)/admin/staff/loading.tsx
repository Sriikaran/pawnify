import React from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function StaffLoading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & User Management"
        description="Create institutional staff credentials, assign branch vault roles, and manage active system access."
        action={<Skeleton variant="text" className="w-40 h-9 rounded-xl" />}
      />

      {/* Table Skeleton */}
      <div className="glass-card p-4 space-y-4">
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: "var(--border-secondary)" }}
        >
          <Skeleton variant="text" className="w-28 h-5" />
          <Skeleton variant="text" className="w-32 h-5" />
          <Skeleton variant="text" className="w-20 h-5" />
          <Skeleton variant="text" className="w-28 h-5" />
          <Skeleton variant="text" className="w-24 h-5" />
          <Skeleton variant="text" className="w-28 h-5" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-3 border-b"
            style={{ borderColor: "var(--border-secondary)" }}
          >
            <div className="flex items-center gap-3">
              <Skeleton variant="circular" className="w-8 h-8 rounded-xl" />
              <div className="space-y-1">
                <Skeleton variant="text" className="w-28 h-4" />
                <Skeleton variant="text" className="w-36 h-3 font-mono" />
              </div>
            </div>
            <Skeleton variant="text" className="w-20 h-6 rounded-full" />
            <Skeleton variant="text" className="w-20 h-6 rounded-full" />
            <Skeleton variant="text" className="w-36 h-4 font-mono" />
            <Skeleton variant="text" className="w-24 h-4" />
            <Skeleton variant="circular" className="w-7 h-7 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
