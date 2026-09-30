"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RefreshCw,
  Coins,
  Clock,
  MapPin,
  Users,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { MarketRates } from "@/lib/services/market-rates";
import { useGetMarketRatesQuery } from "@/lib/redux/api/marketRatesApi";

const DEFAULT_RATES: MarketRates = {
  goldRatePerGram: 7850.0,
  silverRatePerGram: 98.5,
  lastUpdated: "Live",
  safetyMarginPercent: 0,
  source: "API",
  ltvTier1Percent: 85,
  ltvTier2Percent: 80,
  ltvTier3Percent: 75,
  ltvTier1Max: 250000,
  ltvTier2Max: 500000,
  defaultInterestMonthly: 1.5,
  defaultGraceDays: 7,
  panThreshold: 50000,
};

const getBreadcrumbTitle = (pathname: string) => {
  if (pathname === "/dashboard" || pathname === "/") return "Dashboard";
  if (pathname.startsWith("/loans")) return "Loans & Collateral";
  if (pathname.startsWith("/customers")) return "Customer Relations";
  if (pathname.startsWith("/day-book")) return "Day Book Register";
  if (pathname.startsWith("/account-ledger")) return "Account Ledger";
  if (pathname.startsWith("/reports")) return "Financial Reports";
  if (pathname.startsWith("/admin/accounts")) return "Account Master";
  if (pathname.startsWith("/admin/staff")) return "Staff Management";
  if (pathname.startsWith("/admin/settings")) return "System Settings";
  if (pathname.startsWith("/profile")) return "User Profile";
  if (pathname.startsWith("/followups")) return "Follow-up Reminders";
  return "Management";
};

export function LiveMarketTicker() {
  const pathname = usePathname();
  const { data, refetch } = useGetMarketRatesQuery(undefined, {
    pollingInterval: 15 * 60 * 1000,
  });
  const rates: MarketRates = data ?? DEFAULT_RATES;

  const [loading, setLoading] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(now);
      setCurrentDateTime(formatted);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerLiveUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cron/update-rates", { method: "POST" });
      if (res.ok) {
        await refetch();
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 4000);
      }
    } catch (err) {
      console.error("Live update trigger error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header
      className="w-full px-4 lg:px-6 py-2.5 text-xs flex items-center justify-between gap-4 sticky top-0 z-30 transition-colors"
      style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border-primary)",
        boxShadow: "0 1px 3px rgba(53, 29, 20, 0.03)",
      }}
    >
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2 pl-10 lg:pl-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          <span className="text-[#B38646] font-bold text-sm">::</span>
          <span style={{ color: "var(--text-primary)" }}>{getBreadcrumbTitle(pathname)}</span>
        </div>
      </div>

      {/* Center: Quick Action Buttons (Octis style pill container) */}
      <div className="hidden xl:flex items-center gap-1.5 p-1 rounded-xl bg-(--bg-secondary) border border-(--border-primary)">
        <Link
          href="/loans/new"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:bg-white dark:hover:bg-black/30 hover:shadow-xs"
          style={{ color: "var(--text-primary)" }}
        >
          <div className="w-5 h-5 rounded-md bg-[#C59A58]/20 flex items-center justify-center text-[#966727] dark:text-[#E4BE85]">
            <Coins className="w-3 h-3" />
          </div>
          <span>New Loan</span>
        </Link>
        <Link
          href="/customers/new"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:bg-white dark:hover:bg-black/30 hover:shadow-xs"
          style={{ color: "var(--text-primary)" }}
        >
          <div className="w-5 h-5 rounded-md bg-stone-500/15 flex items-center justify-center text-(--text-secondary)">
            <Users className="w-3 h-3" />
          </div>
          <span>Customer</span>
        </Link>
        <Link
          href="/day-book"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:bg-white dark:hover:bg-black/30 hover:shadow-xs"
          style={{ color: "var(--text-primary)" }}
        >
          <div className="w-5 h-5 rounded-md bg-amber-500/15 flex items-center justify-center text-amber-700 dark:text-amber-400">
            <BookOpen className="w-3 h-3" />
          </div>
          <span>Day Book</span>
        </Link>
        <Link
          href="/reports"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:bg-white dark:hover:bg-black/30 hover:shadow-xs"
          style={{ color: "var(--text-primary)" }}
        >
          <div className="w-5 h-5 rounded-md bg-emerald-500/15 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <BarChart3 className="w-3 h-3" />
          </div>
          <span>Reports</span>
        </Link>
      </div>

      {/* Right Controls: Branch Tag, Spot Ticker, Refresh, Clock */}
      <div className="flex items-center gap-2.5 flex-wrap justify-end">
        {/* Branch Selector Pill */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-secondary)",
          }}
        >
          <MapPin className="w-3 h-3 text-[#B38646]" />
          <span>Main Branch</span>
        </div>

        {/* Live Gold Spot Pill (Octis Dark Badge Style) */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#241C16] text-white border border-[#482A1F] text-[11px] shadow-xs">
          <span className="text-[#C59A58] font-bold text-[10px] tracking-wider uppercase">999 GOLD</span>
          <span className="font-mono font-bold text-[#F9F6F0]">
            ₹{rates.goldRatePerGram.toLocaleString("en-IN")}/g
          </span>
        </div>

        {/* Live Silver Spot Pill */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px]"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-secondary)",
          }}
        >
          <span className="text-[10px] font-semibold text-(--text-muted) uppercase">Silver</span>
          <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
            ₹{rates.silverRatePerGram.toLocaleString("en-IN")}/g
          </span>
        </div>

        {/* Refresh Spot Button */}
        <button
          type="button"
          onClick={triggerLiveUpdate}
          disabled={loading}
          className="p-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-50"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-primary)",
            color: "var(--text-muted)",
          }}
          title={justUpdated ? "Market rates updated!" : "Refresh market spot rate"}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#B38646]" : justUpdated ? "text-emerald-500" : ""}`} />
        </button>

        {/* Live Date/Time Display */}
        {currentDateTime && (
          <div
            className="hidden lg:flex items-center gap-1 text-[11px] font-medium pl-1"
            style={{ color: "var(--text-muted)" }}
          >
            <Clock className="w-3 h-3 text-(--text-muted)" />
            <span>{currentDateTime}</span>
          </div>
        )}
      </div>
    </header>
  );
}
