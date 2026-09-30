"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { DashboardCharts } from "@/components/dashboard-charts";
import { useGetDashboardDataQuery } from "@/lib/redux/api/dashboardApi";
import {
  Coins,
  TrendingUp,
  Plus,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Scale,
  Percent,
  BellRing,
  Loader2,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

const formatINR = (val: string | number | undefined | null) => {
  if (val === undefined || val === null) return "₹0";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
};

const formatDate = (dateString: Date | string) => {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
};

const formatDateTime = (dateString: Date | string) => {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};

type PresetRange = "ALL" | "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

export function DashboardClient() {
  const [preset, setPreset] = useState<PresetRange>("ALL");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const filter = useMemo(() => {
    const now = new Date();
    if (preset === "TODAY") {
      const todayStr = now.toISOString().slice(0, 10);
      return { startDate: todayStr, endDate: todayStr };
    }
    if (preset === "WEEK") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        startDate: weekAgo.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10),
      };
    }
    if (preset === "MONTH") {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return {
        startDate: monthAgo.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10),
      };
    }
    if (preset === "CUSTOM") {
      return {
        startDate: customStart || null,
        endDate: customEnd || null,
      };
    }
    return undefined;
  }, [preset, customStart, customEnd]);

  const { data, isLoading, isError } = useGetDashboardDataQuery(filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-(--accent)" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-center text-sm text-(--text-muted)">
        Failed to load dashboard data.
      </div>
    );
  }

  const { stats, chartData } = data;

  const goldCount = chartData.metalBreakdown.find((m) => m.name === "Gold Loans")?.count || 0;
  const silverCount = chartData.metalBreakdown.find((m) => m.name === "Silver Loans")?.count || 0;

  return (
    <div className="space-y-6">
      {/* Top Greeting & Action Controls (Octis Style) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Good day, Administrator
          </h1>
          <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <Calendar className="w-3.5 h-3.5 text-[#B38646]" />
            <span>Today · Main Branch</span>
          </div>
        </div>

        {/* Date Filter & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Buttons */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-primary)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {(
              [
                { id: "TODAY", label: "Today" },
                { id: "WEEK", label: "This Week" },
                { id: "MONTH", label: "This Month" },
                { id: "ALL", label: "All Time" },
                { id: "CUSTOM", label: "Date Range" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setPreset(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  preset === item.id
                    ? "bg-[#B38646] text-white shadow-xs"
                    : "text-(--text-tertiary) hover:text-(--text-primary) hover:bg-(--bg-secondary)"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Link
            href="/loans/new"
            className="btn-primary text-xs px-3.5 py-2 inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Loan</span>
          </Link>
        </div>
      </div>

      {/* Custom Date Selector if active */}
      {preset === "CUSTOM" && (
        <div
          className="glass-card p-3 flex items-center gap-3 text-xs"
          style={{ borderColor: "var(--border-card)" }}
        >
          <Filter className="w-4 h-4 text-[#B38646]" />
          <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
            Select Range:
          </span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="input-field text-xs py-1 px-2.5 rounded-lg max-w-[160px]"
            placeholder="Start Date"
          />
          <span style={{ color: "var(--text-muted)" }}>to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="input-field text-xs py-1 px-2.5 rounded-lg max-w-[160px]"
            placeholder="End Date"
          />
        </div>
      )}

      {/* Primary KPIs Grid (Octis 4-Card Luxury Layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: NET LOAN DISBURSEMENTS */}
        <div className="glass-card p-5 space-y-3 relative group overflow-hidden">
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              NET DISBURSEMENTS
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#C59A58]/15 text-[#966727] dark:text-[#E4BE85] flex items-center justify-center font-bold text-xs">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div
              className="text-2xl sm:text-3xl font-extrabold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {formatINR(stats.disbursementSummary?.totalDisbursed ?? stats.disbursedPeriod?.amount)}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              <span>{stats.disbursementSummary?.count ?? stats.disbursedPeriod?.count ?? 0} loans</span>
              <span className="mx-1">·</span>
              <span>disbursed in period</span>
            </div>
          </div>
          <div
            className="pt-2.5 border-t text-[11px] flex items-center justify-between"
            style={{ borderColor: "var(--border-secondary)", color: "var(--text-tertiary)" }}
          >
            <span>Lifetime Disbursed</span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatINR(stats.portfolioSummary?.totalPrincipalDisbursed)}
            </span>
          </div>
        </div>

        {/* Card 2: ACCRUED INTEREST */}
        <div className="glass-card p-5 space-y-3 relative group overflow-hidden">
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              ACCRUED INTEREST
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Actual/365
            </span>
          </div>
          <div>
            <div
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400"
            >
              {formatINR(stats.totalAccruedInterest ?? 0)}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              <span>Total Exposure: </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatINR(stats.totalExposure ?? stats.totalAUM)}
              </span>
            </div>
          </div>
          <div
            className="pt-2.5 border-t text-[11px] flex items-center justify-between"
            style={{ borderColor: "var(--border-secondary)", color: "var(--text-tertiary)" }}
          >
            <span>Interest Realized</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {formatINR(stats.collectionsSummary?.interestCollected)}
            </span>
          </div>
        </div>

        {/* Card 3: CASH & BANK COLLECTED */}
        <div className="glass-card p-5 space-y-3 relative group overflow-hidden">
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              CASH & BANK COLLECTED
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400"
            >
              {formatINR(stats.collectionsSummary?.totalCollected ?? stats.collectionsToday.amount)}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              <span>{stats.collectionsPeriod?.count ?? stats.collectionsToday.count} receipts</span>
              <span className="mx-1">·</span>
              <span>net of principal & interest</span>
            </div>
          </div>
          <div
            className="pt-2.5 border-t text-[11px] flex items-center justify-between"
            style={{ borderColor: "var(--border-secondary)", color: "var(--text-tertiary)" }}
          >
            <span>Principal Realized</span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatINR(stats.collectionsSummary?.principalCollected)}
            </span>
          </div>
        </div>

        {/* Card 4: OUTSTANDING RECEIVABLE */}
        <div className="glass-card p-5 space-y-3 relative group overflow-hidden">
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              OUTSTANDING RECEIVABLE
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div
              className="text-2xl sm:text-3xl font-extrabold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {formatINR(stats.totalPrincipalOutstanding ?? stats.totalAUM)}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              <span>{stats.activeCount} active loans</span>
              <span className="mx-1">·</span>
              <span className="text-red-600 font-semibold">{stats.overdueCount} overdue</span>
            </div>
          </div>
          <div
            className="pt-2.5 border-t text-[11px] flex items-center justify-between"
            style={{ borderColor: "var(--border-secondary)", color: "var(--text-tertiary)" }}
          >
            <span className="text-red-600">Overdue past grace</span>
            <span className="font-bold text-red-600">
              {formatINR(stats.overdueAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Operational Summaries Section (Phase 10C) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* A. Loan Status Summary */}
        <div className="glass-card p-5 space-y-3" style={{ borderColor: "var(--border-card)" }}>
          <div className="flex items-center justify-between pb-2 border-b border-(--border-secondary)">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Loan Status Summary
            </span>
            <span className="text-xs font-bold" style={{ color: "var(--accent-text)" }}>
              {stats.totalLoansCount ?? stats.activeCount + stats.closedCount} Total
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>Active</span>
              </div>
              <div className="text-right">
                <span className="font-bold">{stats.loanStatusSummary?.active?.count ?? stats.activeCount}</span>
                <span className="text-[11px] text-(--text-muted) ml-2">
                  ({formatINR(stats.loanStatusSummary?.active?.amount)})
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="font-medium text-red-500">Overdue</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-red-500">{stats.loanStatusSummary?.overdue?.count ?? stats.overdueCount}</span>
                <span className="text-[11px] text-red-400 ml-2">
                  ({formatINR(stats.loanStatusSummary?.overdue?.amount ?? stats.overdueAmount)})
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span className="font-medium" style={{ color: "var(--text-muted)" }}>Closed</span>
              </div>
              <div className="text-right">
                <span className="font-bold">{stats.loanStatusSummary?.closed?.count ?? stats.closedCount}</span>
                <span className="text-[11px] text-(--text-muted) ml-2">
                  ({formatINR(stats.loanStatusSummary?.closed?.amount)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* B. Collections Breakdown */}
        <div className="glass-card p-5 space-y-3" style={{ borderColor: "var(--border-card)" }}>
          <div className="flex items-center justify-between pb-2 border-b border-(--border-secondary)">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Collections Summary
            </span>
            <span className="text-xs font-bold text-emerald-600">
              {stats.collectionsPeriod?.count ?? 0} Receipts
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1">
              <span style={{ color: "var(--text-muted)" }}>Principal Realized</span>
              <span className="font-bold">{formatINR(stats.collectionsSummary?.principalCollected)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span style={{ color: "var(--text-muted)" }}>Interest Realized</span>
              <span className="font-bold text-emerald-600">{formatINR(stats.collectionsSummary?.interestCollected)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span style={{ color: "var(--text-muted)" }}>Charges Realized</span>
              <span className="font-bold">{formatINR(stats.collectionsSummary?.chargesCollected)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-(--border-secondary) font-bold">
              <span>Total Inflow</span>
              <span style={{ color: "var(--accent)" }}>
                {formatINR(stats.collectionsSummary?.totalCollected ?? stats.collectionsToday.amount)}
              </span>
            </div>
          </div>
        </div>

        {/* C. Disbursement Summary */}
        <div className="glass-card p-5 space-y-3" style={{ borderColor: "var(--border-card)" }}>
          <div className="flex items-center justify-between pb-2 border-b border-(--border-secondary)">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Disbursement Summary
            </span>
            <span className="text-xs font-bold text-blue-500">
              {stats.disbursementSummary?.count ?? stats.disbursedPeriod?.count ?? 0} Loans
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1">
              <span style={{ color: "var(--text-muted)" }}>Disbursed in Period</span>
              <span className="font-bold text-blue-500">
                {formatINR(stats.disbursementSummary?.totalDisbursed ?? stats.disbursedPeriod?.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span style={{ color: "var(--text-muted)" }}>Disbursed Today</span>
              <span className="font-medium">{formatINR(stats.disbursedToday?.amount)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span style={{ color: "var(--text-muted)" }}>Disbursed This Week</span>
              <span className="font-medium">{formatINR(stats.disbursedWeek?.amount)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-(--border-secondary) font-bold">
              <span>Lifetime Disbursed</span>
              <span style={{ color: "var(--text-primary)" }}>
                {formatINR(stats.portfolioSummary?.totalPrincipalDisbursed)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <DashboardCharts data={chartData} />

      {/* Shop Balance / Custody Liquidity Section (Octis Reference Style) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Shop balance
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Total liquidity & collateral custody in shop
            </p>
          </div>
          <span
            className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-tertiary)",
            }}
          >
            Today
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cash in Hand */}
          <div className="glass-card p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#C59A58]/15 text-[#966727] dark:text-[#E4BE85] flex items-center justify-center font-bold shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-(--text-muted)">
                CASH IN HAND
              </div>
              <div className="text-lg font-extrabold text-(--text-primary)">
                {formatINR(stats.collectionsSummary?.totalCollected ?? stats.collectionsToday.amount)}
              </div>
              <div className="text-[11px] text-(--text-tertiary)">Counter cash collections</div>
            </div>
          </div>

          {/* Bank / Active Portfolio Asset */}
          <div className="glass-card p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-(--text-muted)">
                PRINCIPAL RECEIVABLE
              </div>
              <div className="text-lg font-extrabold text-(--text-primary)">
                {formatINR(stats.totalPrincipalOutstanding ?? stats.totalAUM)}
              </div>
              <div className="text-[11px] text-(--text-tertiary)">Active portfolio assets</div>
            </div>
          </div>

          {/* Pledged Metal Stock */}
          <div className="glass-card p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-(--text-muted)">
                PLEDGED COLLATERAL
              </div>
              <div className="text-lg font-extrabold text-(--text-primary)">
                {goldCount} Gold / {silverCount} Silver
              </div>
              <div className="text-[11px] text-(--text-tertiary)">Pledged jewelry in vault</div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Operational Metrics Grid */}
      <div>
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-3 px-1"
          style={{ color: "var(--text-muted)" }}
        >
          Key Risk & Collateral Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-4 flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-text)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <Percent className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Average Portfolio LTV
              </div>
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {stats.avgLtv}%
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                Regulatory ceiling: 75-85%
              </div>
            </div>
          </div>

          <div className="glass-card p-4 flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
              style={{
                background: "rgba(234, 179, 8, 0.1)",
                color: "#eab308",
                border: "1px solid rgba(234, 179, 8, 0.3)",
              }}
            >
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Collateral Split
              </div>
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {goldCount} Gold / {silverCount} Silver
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                Active pledge distribution
              </div>
            </div>
          </div>

          <Link
            href="/followups"
            className="glass-card p-4 flex items-center gap-4 hover:border-emerald-500/50 transition-all"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
              style={{
                background: "rgba(168, 85, 247, 0.1)",
                color: "#a855f7",
                border: "1px solid rgba(168, 85, 247, 0.3)",
              }}
            >
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Pending Reminders
              </div>
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {stats.pendingFollowUpsCount} tasks
              </div>
              <div className="text-[11px]" style={{ color: "var(--accent-text)" }}>
                Due within 7 days &rarr;
              </div>
            </div>
          </Link>

          <Link
            href="/loans?status=ACTIVE"
            className="glass-card p-4 flex items-center gap-4 hover:border-blue-500/50 transition-all"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "rgba(59, 130, 246, 0.1)",
                color: "#2563eb",
                border: "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Maturity: 30 Days
              </div>
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {stats.dueIn30Days} loans
              </div>
              <div className="text-[11px]" style={{ color: "var(--accent-text)" }}>
                Upcoming renewal window &rarr;
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Main Content Grid: Overdue Attention Table + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Overdue Loans requiring immediate attention */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Action Required: Overdue Accounts
              </h2>
            </div>
            <Link
              href="/loans?status=OVERDUE"
              className="text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: "var(--accent-text)" }}
            >
              <span>View all ({stats.overdueCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="glass-card overflow-hidden">
            {stats.overdueLoans.length === 0 ? (
              <div
                className="p-8 text-center text-sm flex flex-col items-center gap-2"
                style={{ color: "var(--text-muted)" }}
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                <span>No overdue loans currently! All accounts are in good standing.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Loan No.</th>
                      <th>Customer</th>
                      <th>Principal Due</th>
                      <th>Due Date</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.overdueLoans.map((loan) => (
                      <tr key={loan.id}>
                        <td className="font-mono text-xs font-medium">
                          <Link
                            href={`/loans/${loan.id}`}
                            className="hover:underline font-bold"
                            style={{ color: "var(--accent-text)" }}
                          >
                            {loan.loanNumber}
                          </Link>
                        </td>
                        <td>
                          <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                            {loan.customer.fullName}
                          </div>
                          <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                            {loan.customer.phone}
                          </div>
                        </td>
                        <td className="font-semibold text-red-500">
                          {formatINR(loan.principalOutstanding.toString())}
                        </td>
                        <td className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          {formatDate(loan.dueDate)}
                          <div className="text-[10px] text-red-500 font-medium">
                            +{loan.gracePeriodDays}d grace passed
                          </div>
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/loans/${loan.id}`}
                            className="btn-secondary text-xs px-2.5 py-1"
                          >
                            Collect
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Recent Disbursals */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Recent Disbursals
            </h2>
            <Link
              href="/loans"
              className="text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: "var(--accent-text)" }}
            >
              <span>All Loans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="glass-card overflow-hidden" style={{ borderColor: "var(--border-card)" }}>
            {stats.recentLoans.map((loan, i) => (
              <Link
                key={loan.id}
                href={`/loans/${loan.id}`}
                className="block p-4 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderBottom:
                    i < stats.recentLoans.length - 1 ? "1px solid var(--border-secondary)" : "none",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="font-mono text-xs font-medium"
                    style={{ color: "var(--accent-text)" }}
                  >
                    {loan.loanNumber}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                      loan.displayStatus === "ACTIVE"
                        ? "badge-active"
                        : loan.displayStatus === "OVERDUE"
                          ? "badge-overdue"
                          : "badge-closed"
                    }`}
                  >
                    {loan.displayStatus}
                  </span>
                </div>
                <div
                  className="font-medium text-sm truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {loan.customer.fullName}
                </div>
                <div
                  className="flex items-center justify-between mt-2 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span>Disbursed: {formatDate(loan.loanDate)}</span>
                  <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                    {formatINR(loan.principalAmount.toString())}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Section E: Recent Financial Activity (LedgerEntry single-entry log) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Recent Financial Activity (Single-Entry Audit Log)
            </h2>
          </div>
          <Link
            href="/reports?tab=transactions"
            className="text-xs font-medium flex items-center gap-1 transition-colors"
            style={{ color: "var(--accent-text)" }}
          >
            <span>Full Transaction History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="glass-card overflow-hidden" style={{ borderColor: "var(--border-card)" }}>
          {(!stats.recentActivity || stats.recentActivity.length === 0) ? (
            <div className="p-8 text-center text-sm text-(--text-muted)">
              No financial activity recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Flow</th>
                    <th>Amount</th>
                    <th>Principal After</th>
                    <th>Loan No.</th>
                    <th>Customer</th>
                    <th>Account</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.map((act) => (
                    <tr key={act.id}>
                      <td className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDateTime(act.createdAt)}
                      </td>
                      <td className="font-mono text-xs font-semibold">
                        {act.type}
                      </td>
                      <td>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase inline-flex items-center gap-1 ${
                            act.flow === "INFLOW"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : act.flow === "OUTFLOW"
                                ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                          }`}
                        >
                          {act.flow === "INFLOW" && <ArrowDownLeft className="w-3 h-3" />}
                          {act.flow === "OUTFLOW" && <ArrowUpRight className="w-3 h-3" />}
                          {act.flow}
                        </span>
                      </td>
                      <td className="font-bold text-xs" style={{ color: "var(--text-primary)" }}>
                        {formatINR(act.amount)}
                      </td>
                      <td className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        {formatINR(act.principalAfter)}
                      </td>
                      <td className="font-mono text-xs font-medium">
                        <Link
                          href={`/loans/${act.loanNumber}`}
                          className="hover:underline font-bold"
                          style={{ color: "var(--accent-text)" }}
                        >
                          {act.loanNumber}
                        </Link>
                      </td>
                      <td>
                        <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {act.customerName}
                        </div>
                      </td>
                      <td className="text-xs">
                        {act.accountCode ? (
                          <span className="font-mono font-medium text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
                            {act.accountCode} - {act.accountName}
                          </span>
                        ) : (
                          <span className="text-[11px] text-(--text-muted) italic">
                            Unassigned
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
