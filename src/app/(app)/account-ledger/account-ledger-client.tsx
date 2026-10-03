"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Minus,
  Calendar,
  RefreshCw,
  Loader2,
  Phone,
  Search,
  BookOpen,
  AlertCircle,
  AlertTriangle,
  Scale,
  Wallet,
} from "lucide-react";
import { getAccountLedgerAction, listAccountsForLedgerSelectorAction } from "./actions";

interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  description?: string | null;
}

interface AccountLedgerEntry {
  id: string;
  createdAt: string;
  type: "DISBURSEMENT" | "PAYMENT" | "CLOSURE" | "ITEM_RELEASE";
  flow: "INFLOW" | "OUTFLOW" | "NEUTRAL";
  amount: string;
  principalAfter: string;
  runningBalance: string;
  loanId: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  referenceId: string | null;
  description: string;
}

interface AccountLedgerSummary {
  openingBalance: string;
  totalInflow: string;
  totalOutflow: string;
  netMovement: string;
  closingBalance: string;
  transactionCount: number;
  paymentCount: number;
  disbursementCount: number;
  closureCount: number;
  itemReleaseCount: number;
}

const formatINR = (val: number | string) => {
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatTime = (isoString: string) => {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "--:--";
  }
};

const formatDate = (isoString: string) => {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "---";
  }
};

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getYesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type DateFilterMode = "today" | "yesterday" | "date" | "range";

export function AccountLedgerClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialAccountId = searchParams.get("accountId") || "";

  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId);
  const [selectedAccount, setSelectedAccount] = useState<LedgerAccount | null>(null);

  const [dateMode, setDateMode] = useState<DateFilterMode>("today");
  const [singleDate, setSingleDate] = useState<string>(getTodayStr());
  const [fromDate, setFromDate] = useState<string>(getTodayStr());
  const [toDate, setToDate] = useState<string>(getTodayStr());
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [entries, setEntries] = useState<AccountLedgerEntry[]>([]);
  const [summary, setSummary] = useState<AccountLedgerSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  // Load account list
  useEffect(() => {
    let isMounted = true;
    listAccountsForLedgerSelectorAction()
      .then((accs) => {
        if (!isMounted) return;
        setAccounts(accs as LedgerAccount[]);
        if (!selectedAccountId && accs.length > 0) {
          const defaultAcc = accs.find((a: LedgerAccount) => a.code === "CASH-01") || accs[0];
          setSelectedAccountId(defaultAcc.id);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Failed to load accounts.");
      });
    return () => {
      isMounted = false;
    };
  }, [selectedAccountId]);

  // Compute effective start and end dates based on current mode
  const getEffectiveDates = useCallback((): { sDate: string; eDate: string } => {
    if (dateMode === "today") {
      const today = getTodayStr();
      return { sDate: today, eDate: today };
    }
    if (dateMode === "yesterday") {
      const yesterday = getYesterdayStr();
      return { sDate: yesterday, eDate: yesterday };
    }
    if (dateMode === "date") {
      return { sDate: singleDate, eDate: singleDate };
    }
    return { sDate: fromDate, eDate: toDate };
  }, [dateMode, singleDate, fromDate, toDate]);

  // Fetch ledger data
  const fetchLedger = useCallback(
    async (accId: string, sDate: string, eDate: string, q: string) => {
      if (!accId) return;

      // Validate date parameters based on mode
      if (dateMode === "range") {
        if (!sDate) {
          setError("Please select a From date.");
          setLoading(false);
          return;
        }
        if (!eDate) {
          setError("Please select a To date.");
          setLoading(false);
          return;
        }
        const s = new Date(sDate);
        const e = new Date(eDate);
        if (isNaN(s.getTime())) {
          setError("From date is invalid. Please enter a valid date.");
          setLoading(false);
          return;
        }
        if (isNaN(e.getTime())) {
          setError("To date is invalid. Please enter a valid date.");
          setLoading(false);
          return;
        }
        if (sDate > eDate) {
          setError("From date cannot be after To date. Please fix the date range.");
          setLoading(false);
          return;
        }
      } else if (dateMode === "date") {
        if (!sDate) {
          setError("Please select a valid date.");
          setLoading(false);
          return;
        }
        const d = new Date(sDate);
        if (isNaN(d.getTime())) {
          setError("Invalid date. Please enter a valid date.");
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);

      try {
        const res = await getAccountLedgerAction({
          accountId: accId,
          startDate: sDate || null,
          endDate: eDate || null,
          search: q || undefined,
          sortOrder: "asc",
        });

        startTransition(() => {
          setSelectedAccount(res.account as LedgerAccount);
          setEntries(res.entries as AccountLedgerEntry[]);
          setSummary(res.summary as AccountLedgerSummary);
          setLoading(false);
        });
      } catch (err: unknown) {
        startTransition(() => {
          setError(err instanceof Error ? err.message : "Failed to load Account Ledger data.");
          setLoading(false);
        });
      }
    },
    [dateMode]
  );

  // Trigger fetch when parameters change
  useEffect(() => {
    if (selectedAccountId) {
      const { sDate, eDate } = getEffectiveDates();
      fetchLedger(selectedAccountId, sDate, eDate, searchQuery);
    }
  }, [selectedAccountId, getEffectiveDates, searchQuery, fetchLedger]);

  const handleAccountChange = (newAccId: string) => {
    if (newAccId === "ADD_NEW_ACCOUNT") {
      router.push("/admin/accounts?addAccount=true");
      return;
    }
    setSelectedAccountId(newAccId);
    router.replace(`/account-ledger?accountId=${newAccId}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <PageHeader
        title="Account Ledger"
        description="Chronological transaction journal, dynamic running balances, and cash flows for master accounts."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/day-book"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer hover:bg-(--bg-tertiary)"
              style={{
                borderColor: "var(--border-primary)",
                color: "var(--text-secondary)",
                background: "var(--bg-card)",
              }}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Day Book</span>
            </Link>

            <Link
              href="/admin/accounts"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer hover:bg-(--bg-tertiary)"
              style={{
                borderColor: "var(--border-primary)",
                color: "var(--text-secondary)",
                background: "var(--bg-card)",
              }}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Accounts</span>
            </Link>

            <button
              onClick={() => {
                const { sDate, eDate } = getEffectiveDates();
                fetchLedger(selectedAccountId, sDate, eDate, searchQuery);
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer hover:bg-(--bg-tertiary) disabled:opacity-50"
              style={{
                borderColor: "var(--border-primary)",
                color: "var(--text-secondary)",
                background: "var(--bg-card)",
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Account Selector & Filter Card */}
      <div
        className="rounded-2xl p-5 shadow-sm space-y-3"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Account Selector */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Select Account
            </label>
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                disabled={loading && accounts.length === 0}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium border appearance-none transition-all cursor-pointer"
                style={{
                  background: "var(--bg-input)",
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} — {acc.name} ({acc.type}) {!acc.isActive ? "[INACTIVE]" : ""}
                  </option>
                ))}
                <option disabled value="">──────────────</option>
                <option value="ADD_NEW_ACCOUNT" className="font-semibold text-[#B38646]">
                  + Add New Account
                </option>
              </select>
              <Landmark
                className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
          </div>

          {/* Date Filter */}
          <div className="md:col-span-5 space-y-2">
            <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <Calendar className="w-3.5 h-3.5" />
              <span>Date Filter</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: "Today", value: "today" },
                { label: "Yesterday", value: "yesterday" },
                { label: "Date", value: "date" },
                { label: "Date Range", value: "range" },
              ].map((btn) => (
                <button
                  key={btn.value}
                  type="button"
                  onClick={() => {
                    setDateMode(btn.value as DateFilterMode);
                    setError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    dateMode === btn.value
                      ? "bg-[#B38646] text-white shadow-xs"
                      : "bg-(--bg-tertiary) text-(--text-secondary) hover:text-(--text-primary) border border-(--border-primary)"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Single Date Picker */}
            {dateMode === "date" && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-medium text-(--text-muted)">Date:</span>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => {
                    setSingleDate(e.target.value);
                    setError(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-(--bg-tertiary) border border-(--border-primary) text-(--text-primary) focus:outline-none focus:border-(--accent)"
                />
              </div>
            )}

            {/* Date Range Pickers */}
            {dateMode === "range" && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-medium text-(--text-muted)">From:</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setError(null);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-(--bg-tertiary) border border-(--border-primary) text-(--text-primary) focus:outline-none focus:border-(--accent)"
                />
                <span className="text-xs font-medium text-(--text-muted)">To:</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setError(null);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-(--bg-tertiary) border border-(--border-primary) text-(--text-primary) focus:outline-none focus:border-(--accent)"
                />
              </div>
            )}
          </div>

          {/* Search Query */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Search Transactions
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Loan, customer, ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl text-sm border transition-all"
                style={{
                  background: "var(--bg-input)",
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              />
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inactive Account Warning Banner */}
      {selectedAccount && !selectedAccount.isActive && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-600 dark:text-amber-400 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm">Account Inactive (Historical Mode)</div>
            <p className="mt-0.5 text-xs opacity-90">
              Account <strong>{selectedAccount.name}</strong> ({selectedAccount.code}) is deactivated.
              Its historical transactions and balances remain fully viewable, but new postings cannot be made to this account.
            </p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-500 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards: Dynamic Balance Derivations */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Opening Balance */}
          <div
            className="p-4 rounded-2xl border transition-all"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-primary)",
            }}
          >
            <div className="flex items-center justify-between text-xs font-medium text-(--text-muted) mb-1.5">
              <span>Opening Balance</span>
              <Scale className="w-3.5 h-3.5" />
            </div>
            <div className="text-lg font-bold font-mono tracking-tight" style={{ color: "var(--text-primary)" }}>
              {formatINR(summary.openingBalance)}
            </div>
            <p className="text-[10px] text-(--text-muted) mt-1 truncate">
              {getEffectiveDates().sDate ? `Prior to ${formatDate(getEffectiveDates().sDate)}` : "Initial state"}
            </p>
          </div>

          {/* Period Inflow */}
          <div
            className="p-4 rounded-2xl border transition-all bg-emerald-500/5 border-emerald-500/20"
          >
            <div className="flex items-center justify-between text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5">
              <span>Total Inflow (+)</span>
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
            <div className="text-lg font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              +{formatINR(summary.totalInflow)}
            </div>
            <p className="text-[10px] text-(--text-muted) mt-1">
              {summary.paymentCount} payments
            </p>
          </div>

          {/* Period Outflow */}
          <div
            className="p-4 rounded-2xl border transition-all bg-rose-500/5 border-rose-500/20"
          >
            <div className="flex items-center justify-between text-xs font-medium text-rose-600 dark:text-rose-400 mb-1.5">
              <span>Total Outflow (-)</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <div className="text-lg font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400">
              -{formatINR(summary.totalOutflow)}
            </div>
            <p className="text-[10px] text-(--text-muted) mt-1">
              {summary.disbursementCount} disbursements
            </p>
          </div>

          {/* Net Movement */}
          <div
            className="p-4 rounded-2xl border transition-all"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-primary)",
            }}
          >
            <div className="flex items-center justify-between text-xs font-medium text-(--text-muted) mb-1.5">
              <span>Net Movement</span>
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <div
              className={`text-lg font-bold font-mono tracking-tight ${
                parseFloat(summary.netMovement) > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : parseFloat(summary.netMovement) < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : ""
              }`}
            >
              {parseFloat(summary.netMovement) > 0 ? "+" : ""}
              {formatINR(summary.netMovement)}
            </div>
            <p className="text-[10px] text-(--text-muted) mt-1">
              Inflows minus outflows
            </p>
          </div>

          {/* Closing Balance */}
          <div
            className="p-4 rounded-2xl border transition-all bg-(--accent-bg) border-(--accent-border)"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-(--accent-text) mb-1.5">
              <span>Closing Balance</span>
              <Landmark className="w-3.5 h-3.5" />
            </div>
            <div className="text-lg font-bold font-mono tracking-tight text-(--accent-text)">
              {formatINR(summary.closingBalance)}
            </div>
            <p className="text-[10px] text-(--text-muted) mt-1">
              Opening + Net
            </p>
          </div>

          {/* Transaction Count */}
          <div
            className="p-4 rounded-2xl border transition-all"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-primary)",
            }}
          >
            <div className="flex items-center justify-between text-xs font-medium text-(--text-muted) mb-1.5">
              <span>Transactions</span>
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div className="text-lg font-bold font-mono tracking-tight" style={{ color: "var(--text-primary)" }}>
              {summary.transactionCount}
            </div>
            <p className="text-[10px] text-(--text-muted) mt-1">
              In period
            </p>
          </div>
        </div>
      )}

      {/* Transactions Table Card */}
      <div
        className="rounded-2xl border shadow-sm overflow-hidden"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-primary)",
        }}
      >
        <div
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <div>
            <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Chronological Ledger Journal
            </h2>
            <p className="text-xs mt-0.5 text-(--text-muted)">
              {selectedAccount
                ? `${selectedAccount.code} — ${selectedAccount.name} (${selectedAccount.type})`
                : "Select an account to view transactions"}
            </p>
          </div>
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-(--text-muted)">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-(--accent)" />
              <span>Calculating balances...</span>
            </div>
          )}
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead
              className="text-[11px] font-semibold uppercase tracking-wider border-b select-none"
              style={{
                background: "var(--bg-tertiary)",
                borderColor: "var(--border-primary)",
                color: "var(--text-muted)",
              }}
            >
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-3">Event</th>
                <th className="py-3 px-3">Flow</th>
                <th className="py-3 px-4">Loan & Customer</th>
                <th className="py-3 px-4">Description / Reference</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Principal After</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody
              className="divide-y"
              style={{ borderColor: "var(--border-primary)" }}
            >
              {entries.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-(--text-muted)">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Scale className="w-8 h-8 mx-auto opacity-30" />
                      <p className="font-semibold text-sm">No transactions found</p>
                      <p className="text-xs">
                        There are no ledger entries matching the selected account and filter criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-(--bg-tertiary) transition-colors"
                  >
                    {/* Date & Time */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {formatDate(entry.createdAt)}
                      </div>
                      <div className="text-[10px] font-mono text-(--text-muted)">
                        {formatTime(entry.createdAt)}
                      </div>
                    </td>

                    {/* Event Type Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold"
                        style={{
                          background:
                            entry.type === "PAYMENT"
                              ? "rgba(16, 185, 129, 0.12)"
                              : entry.type === "DISBURSEMENT"
                              ? "rgba(244, 63, 94, 0.12)"
                              : "rgba(100, 116, 139, 0.12)",
                          color:
                            entry.type === "PAYMENT"
                              ? "#10b981"
                              : entry.type === "DISBURSEMENT"
                              ? "#f43f5e"
                              : "#64748b",
                        }}
                      >
                        {entry.type}
                      </span>
                    </td>

                    {/* Flow Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          background:
                            entry.flow === "INFLOW"
                              ? "rgba(16, 185, 129, 0.1)"
                              : entry.flow === "OUTFLOW"
                              ? "rgba(244, 63, 94, 0.1)"
                              : "rgba(148, 163, 184, 0.1)",
                          color:
                            entry.flow === "INFLOW"
                              ? "#10b981"
                              : entry.flow === "OUTFLOW"
                              ? "#f43f5e"
                              : "#94a3b8",
                        }}
                      >
                        {entry.flow === "INFLOW" && <ArrowDownLeft className="w-3 h-3" />}
                        {entry.flow === "OUTFLOW" && <ArrowUpRight className="w-3 h-3" />}
                        {entry.flow === "NEUTRAL" && <Minus className="w-3 h-3" />}
                        {entry.flow}
                      </span>
                    </td>

                    {/* Loan & Customer */}
                    <td className="py-3 px-4">
                      <Link
                        href={`/loans/${entry.loanId}`}
                        className="font-mono font-semibold hover:underline"
                        style={{ color: "var(--accent)" }}
                      >
                        {entry.loanNumber}
                      </Link>
                      <div className="flex items-center gap-1.5 text-[11px] text-(--text-muted) mt-0.5">
                        <span className="truncate max-w-[140px] font-medium" style={{ color: "var(--text-secondary)" }}>
                          {entry.customerName}
                        </span>
                        {entry.customerPhone && (
                          <span className="flex items-center gap-0.5 text-[10px] font-mono">
                            <Phone className="w-2.5 h-2.5" />
                            {entry.customerPhone.slice(-4)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Description / Reference */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="truncate" style={{ color: "var(--text-secondary)" }}>
                        {entry.description}
                      </div>
                      {entry.referenceId && (
                        <div className="text-[10px] font-mono text-(--text-muted) truncate mt-0.5">
                          Ref: {entry.referenceId}
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right font-mono font-semibold whitespace-nowrap">
                      {parseFloat(entry.amount) > 0 ? (
                        <span
                          className={
                            entry.flow === "INFLOW"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {entry.flow === "INFLOW" ? "+" : "-"}
                          {formatINR(entry.amount)}
                        </span>
                      ) : (
                        <span className="text-(--text-muted)">₹0.00</span>
                      )}
                    </td>

                    {/* Principal After */}
                    <td className="py-3 px-4 text-right font-mono text-(--text-secondary) whitespace-nowrap">
                      {formatINR(entry.principalAfter)}
                    </td>

                    {/* Running Balance */}
                    <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                      <span
                        className="px-2 py-1 rounded-md text-[11px]"
                        style={{
                          background: "var(--bg-tertiary)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-primary)",
                        }}
                      >
                        {formatINR(entry.runningBalance)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
