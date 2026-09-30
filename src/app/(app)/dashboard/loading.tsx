import React from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Operational Dashboard"
        description="Real-time overview of active pawn loans, collections, LTV metrics, and overdue accounts."
        action={
          <div className="flex items-center gap-2.5">
            <Skeleton variant="text" className="w-32 h-9 rounded-xl" />
            <Skeleton variant="text" className="w-36 h-9 rounded-xl" />
          </div>
        }
      />

      {/* Primary KPIs Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi-card space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton variant="text" className="w-24 h-4" />
              <Skeleton variant="circular" className="w-10 h-10 rounded-xl" />
            </div>
            <Skeleton variant="text" className="w-36 h-8" />
            <Skeleton variant="text" className="w-48 h-3" />
          </div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <Skeleton variant="card" className="w-full h-80 rounded-2xl" />

      {/* Secondary Metrics Grid Skeleton */}
      <div className="space-y-4">
        <Skeleton variant="text" className="w-64 h-5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card p-4 flex items-center gap-4">
              <Skeleton variant="circular" className="w-12 h-12 rounded-xl" />
              <div className="space-y-1.5 flex-1">
                <Skeleton variant="text" className="w-20 h-3" />
                <Skeleton variant="text" className="w-28 h-6" />
                <Skeleton variant="text" className="w-32 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tables & Lists Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton variant="text" className="w-56 h-6" />
          <Skeleton variant="card" className="w-full h-64 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton variant="text" className="w-40 h-6" />
          <Skeleton variant="card" className="w-full h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
