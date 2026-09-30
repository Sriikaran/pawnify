"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  BookOpen,
  Coins,
  CreditCard,
  Filter,
  Landmark,
  Loader2,
  PieChart,
  Search,
  TrendingDown,
  Users,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
} from "lucide-react";
import {
  useGetLoanRegisterQuery,
  useGetPaymentRegisterQuery,
  useGetDisbursementRegisterQuery,
  useGetOverdueLoansQuery,
  useGetCustomerWiseSummaryQuery,
  useGetAccountWiseSummaryQuery,
  useGetDayBookSummaryReportQuery,
  useGetPortfolioSummaryQuery,
  useGetTransactionHistoryQuery,
} from "@/lib/redux/api/reportsApi";

const formatINR = (val: number | string | undefined | null) => {
  if (val === undefined || val === null) return "₹0";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
};

const formatDate = (dateString: Date | string | null | undefined) => {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
};

const formatDateTime = (dateString: Date | string | null | undefined) => {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};

type ReportTab =
  | "portfolio"
  | "loans"
  | "payments"
  | "disbursements"
  | "overdue"
  | "customers"
  | "accounts"
  | "daybook"
  | "transactions";

export function ReportsClient() {
  const [activeTab, setActiveTab] = useState<ReportTab>("portfolio");

  // Common filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [loanStatus, setLoanStatus] = useState<"ALL" | "ACTIVE" | "OVERDUE" | "CLOSED">("ALL");
  const [paymentMode, setPaymentMode] = useState<"ALL" | "CASH" | "UPI" | "BANK_TRANSFER" | "CARD">("ALL");

  // Query hooks
  const portfolioQuery = useGetPortfolioSummaryQuery({ startDate: startDate || null, endDate: endDate || null });
  const loanRegisterQuery = useGetLoanRegisterQuery({ startDate: startDate || null, endDate: endDate || null, search, status: loanStatus });
  const paymentRegisterQuery = useGetPaymentRegisterQuery({ startDate: startDate || null, endDate: endDate || null, search, mode: paymentMode });
  const disbursementRegisterQuery = useGetDisbursementRegisterQuery({ startDate: startDate || null, endDate: endDate || null, search });
  const overdueLoansQuery = useGetOverdueLoansQuery({ search });
  const customerSummaryQuery = useGetCustomerWiseSummaryQuery({ search });
  const accountSummaryQuery = useGetAccountWiseSummaryQuery({ startDate: startDate || null, endDate: endDate || null, search });
  const dayBookSummaryQuery = useGetDayBookSummaryReportQuery({ startDate: startDate || null, endDate: endDate || null });
  const transactionHistoryQuery = useGetTransactionHistoryQuery({ startDate: startDate || null, endDate: endDate || null, search });

  const tabs: { id: ReportTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "portfolio", label: "Portfolio Summary", icon: PieChart },
    { id: "loans", label: "Loan Register", icon: Coins },
    { id: "payments", label: "Collection Register", icon: CreditCard },
    { id: "disbursements", label: "Disbursement Register", icon: TrendingDown },
    { id: "overdue", label: "Overdue Loans", icon: AlertTriangle },
    { id: "customers", label: "Customer Summary", icon: Users },
    { id: "accounts", label: "Account Summary", icon: Landmark },
    { id: "daybook", label: "Day Book Summary", icon: BookOpen },
    { id: "transactions", label: "Transaction History", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Financial Statements"
        description="Comprehensive read-only derived reports over single-entry financial ledger events and loan records."
      />

      {/* Segmented Tabs Bar (Octis style) */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-(--bg-card) border border-(--border-primary) shadow-xs overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                active
                  ? "bg-[#B38646] text-white shadow-xs"
                  : "text-(--text-tertiary) hover:text-(--text-primary) hover:bg-(--bg-secondary)"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div
        className="glass-card p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
        style={{ borderColor: "var(--border-card)" }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
            <span className="font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--text-muted)" }}>
              Filters:
            </span>
          </div>

          {/* Date range (for tabs that support it) */}
          {activeTab !== "overdue" && activeTab !== "customers" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field text-xs py-1 px-2 rounded-lg"
                placeholder="From Date"
              />
              <span style={{ color: "var(--text-muted)" }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field text-xs py-1 px-2 rounded-lg"
                placeholder="To Date"
              />
            </div>
          )}

          {/* Search box */}
          {activeTab !== "portfolio" && activeTab !== "daybook" && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-(--text-muted)" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field text-xs py-1 pl-8 pr-2 rounded-lg w-40 sm:w-56"
              />
            </div>
          )}

          {/* Status selector (Loan Register) */}
          {activeTab === "loans" && (
            <select
              value={loanStatus}
              onChange={(e) => setLoanStatus(e.target.value as "ALL" | "ACTIVE" | "OVERDUE" | "CLOSED")}
              className="input-field text-xs py-1 px-2 rounded-lg"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="OVERDUE">Overdue Only</option>
              <option value="CLOSED">Closed Only</option>
            </select>
          )}

          {/* Mode selector (Payment Register) */}
          {activeTab === "payments" && (
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as "ALL" | "CASH" | "UPI" | "BANK_TRANSFER" | "CARD")}
              className="input-field text-xs py-1 px-2 rounded-lg"
            >
              <option value="ALL">All Payment Modes</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CARD">Card</option>
            </select>
          )}

          {(startDate || endDate || search || loanStatus !== "ALL" || paymentMode !== "ALL") && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setSearch("");
                setLoanStatus("ALL");
                setPaymentMode("ALL");
              }}
              className="text-[11px] text-(--accent-text) hover:underline cursor-pointer ml-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ==================== 1. PORTFOLIO SUMMARY TAB ==================== */}
      {activeTab === "portfolio" && (
        <div className="space-y-6">
          {portfolioQuery.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-(--accent)" /></div>
          ) : portfolioQuery.data ? (
            <>
              {/* Point-in-time Lifetime Metrics */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Point-In-Time Portfolio Position
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="kpi-card">
                    <div className="text-xs text-(--text-muted) uppercase font-medium">Principal Outstanding</div>
                    <div className="text-2xl font-bold mt-1 text-(--text-primary)">
                      {formatINR(portfolioQuery.data.pointInTime.principalOutstandingTotal)}
                    </div>
                    <div className="text-xs text-(--text-muted) mt-1">
                      {portfolioQuery.data.pointInTime.activeLoanCount} active loans
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="text-xs text-(--text-muted) uppercase font-medium">Accrued Interest</div>
                    <div className="text-2xl font-bold mt-1 text-emerald-600">
                      {formatINR(portfolioQuery.data.pointInTime.accruedInterestTotal)}
                    </div>
                    <div className="text-xs text-(--text-muted) mt-1">
                      Actual/365 simple interest
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="text-xs text-(--text-muted) uppercase font-medium">Total Portfolio Exposure</div>
                    <div className="text-2xl font-bold mt-1 text-(--accent)">
                      {formatINR(portfolioQuery.data.pointInTime.totalExposure)}
                    </div>
                    <div className="text-xs text-(--text-muted) mt-1">
                      Principal + Accrued Interest
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="text-xs text-red-500 uppercase font-medium">Overdue Accounts</div>
                    <div className="text-2xl font-bold mt-1 text-red-500">
                      {portfolioQuery.data.pointInTime.overdueLoanCount}
                    </div>
                    <div className="text-xs text-(--text-muted) mt-1">
                      Loans past grace period
                    </div>
                  </div>
                </div>
              </div>

              {/* Period Activity Metrics */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Period Activity Metrics {portfolioQuery.data.period.startDate ? `(${formatDate(portfolioQuery.data.period.startDate)} - ${formatDate(portfolioQuery.data.period.endDate)})` : "(Lifetime)"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass-card p-4 space-y-1">
                    <div className="text-xs text-(--text-muted) uppercase font-medium">Disbursements in Period</div>
                    <div className="text-xl font-bold text-blue-500">
                      {formatINR(portfolioQuery.data.period.disbursementsAmount)}
                    </div>
                    <div className="text-xs text-(--text-muted)">{portfolioQuery.data.period.disbursementsCount} loan contracts</div>
                  </div>

                  <div className="glass-card p-4 space-y-1">
                    <div className="text-xs text-(--text-muted) uppercase font-medium">Collections in Period</div>
                    <div className="text-xl font-bold text-emerald-600">
                      {formatINR(portfolioQuery.data.period.collectionsAmount)}
                    </div>
                    <div className="text-xs text-(--text-muted)">{portfolioQuery.data.period.collectionsCount} receipts issued</div>
                  </div>

                  <div className="glass-card p-4 space-y-1">
                    <div className="text-xs text-(--text-muted) uppercase font-medium">Interest Realized</div>
                    <div className="text-xl font-bold text-emerald-600">
                      {formatINR(portfolioQuery.data.period.interestCollected)}
                    </div>
                    <div className="text-xs text-(--text-muted)">Waterfall tier 2</div>
                  </div>

                  <div className="glass-card p-4 space-y-1">
                    <div className="text-xs text-(--text-muted) uppercase font-medium">Charges Realized</div>
                    <div className="text-xl font-bold">
                      {formatINR(portfolioQuery.data.period.chargesCollected)}
                    </div>
                    <div className="text-xs text-(--text-muted)">Waterfall tier 1 (fees/penal)</div>
                  </div>
                </div>
              </div>

              {/* Collateral Composition */}
              <div className="glass-card p-5 space-y-3" style={{ borderColor: "var(--border-card)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
                  Collateral Distribution
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 space-y-1">
                    <div className="text-xs font-bold text-amber-500 uppercase">Gold Pledges</div>
                    <div className="text-xl font-bold">{portfolioQuery.data.pointInTime.goldLoansCount} Loans</div>
                    <div className="text-xs text-(--text-muted)">
                      Total Assessed Value: {formatINR(portfolioQuery.data.pointInTime.goldAssessedValue)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 space-y-1">
                    <div className="text-xs font-bold text-slate-400 uppercase">Silver Pledges</div>
                    <div className="text-xl font-bold">{portfolioQuery.data.pointInTime.silverLoansCount} Loans</div>
                    <div className="text-xs text-(--text-muted)">
                      Total Assessed Value: {formatINR(portfolioQuery.data.pointInTime.silverAssessedValue)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ==================== 2. LOAN REGISTER TAB ==================== */}
      {activeTab === "loans" && (
        <div className="space-y-4">
          {loanRegisterQuery.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-(--accent)" /></div>
          ) : loanRegisterQuery.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Loans</div>
                  <div className="text-xl font-bold mt-1">{loanRegisterQuery.data.summary.totalLoans}</div>
                  <div className="text-[11px] text-(--text-muted)">
                    {loanRegisterQuery.data.summary.activeCount} active, {loanRegisterQuery.data.summary.overdueCount} overdue, {loanRegisterQuery.data.summary.closedCount} closed
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Principal Disbursed</div>
                  <div className="text-xl font-bold mt-1">{formatINR(loanRegisterQuery.data.summary.totalPrincipalAmount)}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Principal Outstanding</div>
                  <div className="text-xl font-bold mt-1 text-(--accent)">{formatINR(loanRegisterQuery.data.summary.totalPrincipalOutstanding)}</div>
                </div>
              </div>

              <div className="glass-card overflow-hidden" style={{ borderColor: "var(--border-card)" }}>
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Loan No.</th>
                        <th>Customer</th>
                        <th>Loan Date</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th>Rate/Mo</th>
                        <th>Principal Disbursed</th>
                        <th>Principal Outstanding</th>
                        <th>Collateral</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanRegisterQuery.data.items.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-8 text-(--text-muted)">No loans found matching the criteria.</td></tr>
                      ) : (
                        loanRegisterQuery.data.items.map((item) => (
                          <tr key={item.id}>
                            <td className="font-mono text-xs font-bold">
                              <Link href={`/loans/${item.id}`} className="hover:underline text-(--accent)">{item.loanNumber}</Link>
                            </td>
                            <td>
                              <div className="font-medium text-xs text-(--text-primary)">{item.customerName}</div>
                              <div className="text-[11px] font-mono text-(--text-muted)">{item.customerPhone}</div>
                            </td>
                            <td className="text-xs text-(--text-muted)">{formatDate(item.loanDate)}</td>
                            <td className="text-xs text-(--text-muted)">{formatDate(item.dueDate)}</td>
                            <td>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                item.displayStatus === "ACTIVE" ? "badge-active" : item.displayStatus === "OVERDUE" ? "badge-overdue" : "badge-closed"
                              }`}>
                                {item.displayStatus}
                              </span>
                            </td>
                            <td className="text-xs font-mono">{item.interestRateMonthly}%</td>
                            <td className="text-xs font-semibold">{formatINR(item.principalAmount)}</td>
                            <td className="text-xs font-bold text-(--accent)">{formatINR(item.principalOutstanding)}</td>
                            <td className="text-[11px] text-(--text-muted)">{item.collateralSummary}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ==================== 3. PAYMENT / COLLECTION REGISTER TAB ==================== */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {paymentRegisterQuery.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-(--accent)" /></div>
          ) : paymentRegisterQuery.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Collections</div>
                  <div className="text-xl font-bold mt-1 text-emerald-600">{formatINR(paymentRegisterQuery.data.summary.totalAmountPaid)}</div>
                  <div className="text-[11px] text-(--text-muted)">{paymentRegisterQuery.data.summary.totalPayments} receipts</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Principal Allocation</div>
                  <div className="text-xl font-bold mt-1">{formatINR(paymentRegisterQuery.data.summary.totalAllocatedPrincipal)}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Interest Allocation</div>
                  <div className="text-xl font-bold mt-1 text-emerald-600">{formatINR(paymentRegisterQuery.data.summary.totalAllocatedInterest)}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Charges Allocation</div>
                  <div className="text-xl font-bold mt-1">{formatINR(paymentRegisterQuery.data.summary.totalAllocatedCharges)}</div>
                </div>
              </div>

              <div className="glass-card overflow-hidden" style={{ borderColor: "var(--border-card)" }}>
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Receipt No.</th>
                        <th>Date</th>
                        <th>Loan No.</th>
                        <th>Customer</th>
                        <th>Amount Paid</th>
                        <th>Principal Alloc.</th>
                        <th>Interest Alloc.</th>
                        <th>Charges Alloc.</th>
                        <th>Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentRegisterQuery.data.items.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-8 text-(--text-muted)">No payment receipts found.</td></tr>
                      ) : (
                        paymentRegisterQuery.data.items.map((p) => (
                          <tr key={p.id}>
                            <td className="font-mono text-xs font-bold text-(--accent)">{p.receiptNumber}</td>
                            <td className="text-xs text-(--text-muted)">{formatDate(p.paymentDate)}</td>
                            <td className="font-mono text-xs">
                              <Link href={`/loans/${p.loanId}`} className="hover:underline">{p.loanNumber}</Link>
                            </td>
                            <td>
                              <div className="font-medium text-xs">{p.customerName}</div>
                              <div className="text-[11px] font-mono text-(--text-muted)">{p.customerPhone}</div>
                            </td>
                            <td className="font-bold text-xs text-emerald-600">{formatINR(p.amountPaid)}</td>
                            <td className="text-xs">{formatINR(p.allocatedPrincipal)}</td>
                            <td className="text-xs text-emerald-600">{formatINR(p.allocatedInterest)}</td>
                            <td className="text-xs">{formatINR(p.allocatedCharges)}</td>
                            <td className="text-xs">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/5 dark:bg-white/5 uppercase">
                                {p.mode}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ==================== 4. DISBURSEMENT REGISTER TAB ==================== */}
      {activeTab === "disbursements" && (
        <div className="space-y-4">
          {disbursementRegisterQuery.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-(--accent)" /></div>
          ) : disbursementRegisterQuery.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Disbursements</div>
                  <div className="text-2xl font-bold mt-1 text-blue-500">
                    {formatINR(disbursementRegisterQuery.data.summary.totalDisbursedAmount)}
                  </div>
                  <div className="text-xs text-(--text-muted) mt-1">
                    {disbursementRegisterQuery.data.summary.totalDisbursements} loan disbursements recorded
                  </div>
                </div>
              </div>

              <div className="glass-card overflow-hidden" style={{ borderColor: "var(--border-card)" }}>
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Loan No.</th>
                        <th>Customer</th>
                        <th>Amount Disbursed</th>
                        <th>Account</th>
                        <th>Tenure</th>
                        <th>Rate/Mo</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disbursementRegisterQuery.data.items.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-8 text-(--text-muted)">No disbursement records found.</td></tr>
                      ) : (
                        disbursementRegisterQuery.data.items.map((d) => (
                          <tr key={d.id}>
                            <td className="text-xs text-(--text-muted)">{formatDateTime(d.disbursementDate)}</td>
                            <td className="font-mono text-xs font-bold">
                              <Link href={`/loans/${d.loanId}`} className="hover:underline text-(--accent)">{d.loanNumber}</Link>
                            </td>
                            <td>
                              <div className="font-medium text-xs">{d.customerName}</div>
                              <div className="text-[11px] font-mono text-(--text-muted)">{d.customerPhone}</div>
                            </td>
                            <td className="font-bold text-xs text-blue-500">{formatINR(d.disbursementAmount)}</td>
                            <td className="text-xs">
                              {d.accountCode ? (
                                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
                                  {d.accountCode}
                                </span>
                              ) : (
                                <span className="text-[11px] text-(--text-muted) italic">Unassigned</span>
                              )}
                            </td>
                            <td className="text-xs">{d.tenureMonths} mos</td>
                            <td className="text-xs font-mono">{d.interestRateMonthly}%</td>
                            <td className="text-xs text-(--text-muted) max-w-xs truncate">{d.description}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ==================== 5. OVERDUE LOANS TAB ==================== */}
      {activeTab === "overdue" && (
        <div className="space-y-4">
          {overdueLoansQuery.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-(--accent)" /></div>
          ) : overdueLoansQuery.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="kpi-card border-red-500/20">
                  <div className="text-xs text-red-500 uppercase font-semibold">Overdue Accounts</div>
                  <div className="text-2xl font-bold mt-1 text-red-500">
                    {overdueLoansQuery.data.summary.totalOverdueLoans}
                  </div>
                  <div className="text-xs text-(--text-muted) mt-1">Contracts past grace period</div>
                </div>
                <div className="kpi-card border-red-500/20">
                  <div className="text-xs text-red-500 uppercase font-semibold">Overdue Principal</div>
                  <div className="text-2xl font-bold mt-1 text-red-500">
                    {formatINR(overdueLoansQuery.data.summary.totalPrincipalOutstanding)}
                  </div>
                </div>
                <div className="kpi-card border-red-500/20">
                  <div className="text-xs text-(--text-muted) uppercase font-semibold">Total Due (incl Interest)</div>
                  <div className="text-2xl font-bold mt-1 text-(--text-primary)">
                    {formatINR(overdueLoansQuery.data.summary.totalDue)}
                  </div>
                  <div className="text-xs text-emerald-600 mt-1">
                    +{formatINR(overdueLoansQuery.data.summary.totalAccruedInterest)} accrued interest
                  </div>
                </div>
              </div>

              <div className="glass-card overflow-hidden" style={{ borderColor: "var(--border-card)" }}>
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Loan No.</th>
                        <th>Customer</th>
                        <th>Due Date</th>
                        <th>Days Overdue</th>
                        <th>Rate/Mo</th>
                        <th>Principal Due</th>
                        <th>Accrued Interest</th>
                        <th>Total Due</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueLoansQuery.data.items.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-8 text-(--text-muted)">No overdue loans at this time. All accounts are compliant!</td></tr>
                      ) : (
                        overdueLoansQuery.data.items.map((loan) => (
                          <tr key={loan.id}>
                            <td className="font-mono text-xs font-bold">
                              <Link href={`/loans/${loan.id}`} className="hover:underline text-red-500">{loan.loanNumber}</Link>
                            </td>
                            <td>
                              <div className="font-medium text-xs">{loan.customerName}</div>
                              <div className="text-[11px] font-mono text-(--text-muted)">{loan.customerPhone}</div>
                            </td>
                            <td className="text-xs text-(--text-muted)">{formatDate(loan.dueDate)}</td>
                            <td>
                              <span className="text-xs font-bold text-red-500">
                                {loan.daysOverdue} days
                              </span>
                            </td>
                            <td className="text-xs font-mono">{loan.interestRateMonthly}%</td>
                            <td className="text-xs font-semibold text-red-500">{formatINR(loan.principalOutstanding)}</td>
                            <td className="text-xs text-emerald-600 font-medium">{formatINR(loan.accruedInterest)}</td>
                            <td className="text-xs font-bold text-(--text-primary)">{formatINR(loan.totalDue)}</td>
                            <td className="text-right">
                              <Link href={`/loans/${loan.id}`} className="btn-secondary text-xs px-2.5 py-1">
                                Collect
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ==================== 6. CUSTOMER-WISE SUMMARY TAB ==================== */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          {customerSummaryQuery.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-(--accent)" /></div>
          ) : customerSummaryQuery.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Customers</div>
                  <div className="text-xl font-bold mt-1">{customerSummaryQuery.data.summary.totalCustomers}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Contracts</div>
                  <div className="text-xl font-bold mt-1">{customerSummaryQuery.data.summary.totalLoans}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Outstanding Principal</div>
                  <div className="text-xl font-bold mt-1 text-(--accent)">{formatINR(customerSummaryQuery.data.summary.totalOutstandingPrincipal)}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Accrued Interest</div>
                  <div className="text-xl font-bold mt-1 text-emerald-600">{formatINR(customerSummaryQuery.data.summary.totalAccruedInterest)}</div>
                </div>
              </div>

              <div className="glass-card overflow-hidden" style={{ borderColor: "var(--border-card)" }}>
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Total Loans</th>
                        <th>Active</th>
                        <th>Overdue</th>
                        <th>Closed</th>
                        <th>Outstanding Principal</th>
                        <th>Accrued Interest</th>
                        <th>Total Payments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerSummaryQuery.data.items.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-8 text-(--text-muted)">No customers found.</td></tr>
                      ) : (
                        customerSummaryQuery.data.items.map((c) => (
                          <tr key={c.customerId}>
                            <td className="font-medium text-xs">
                              <Link href={`/customers/${c.customerId}`} className="hover:underline text-(--accent)">
                                {c.customerName}
                              </Link>
                            </td>
                            <td className="font-mono text-xs text-(--text-muted)">{c.phone}</td>
                            <td className="text-xs font-bold">{c.totalLoans}</td>
                            <td className="text-xs text-emerald-600 font-semibold">{c.activeLoans}</td>
                            <td className="text-xs text-red-500 font-semibold">{c.overdueLoans}</td>
                            <td className="text-xs text-(--text-muted)">{c.closedLoans}</td>
                            <td className="text-xs font-bold">{formatINR(c.outstandingPrincipal)}</td>
                            <td className="text-xs text-emerald-600">{formatINR(c.accruedInterest)}</td>
                            <td className="text-xs font-semibold">{formatINR(c.totalPayments)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ==================== 7. ACCOUNT-WISE SUMMARY TAB ==================== */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          {accountSummaryQuery.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-(--accent)" /></div>
          ) : accountSummaryQuery.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Accounts Tracked</div>
                  <div className="text-xl font-bold mt-1">{accountSummaryQuery.data.summary.totalAccounts}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Inflow (Collections)</div>
                  <div className="text-xl font-bold mt-1 text-emerald-600">{formatINR(accountSummaryQuery.data.summary.totalInflowAllAccounts)}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Outflow (Disbursements)</div>
                  <div className="text-xl font-bold mt-1 text-blue-500">{formatINR(accountSummaryQuery.data.summary.totalOutflowAllAccounts)}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Net Cash Movement</div>
                  <div className="text-xl font-bold mt-1 text-(--accent)">{formatINR(accountSummaryQuery.data.summary.netMovementAllAccounts)}</div>
                </div>
              </div>

              <div className="glass-card overflow-hidden" style={{ borderColor: "var(--border-card)" }}>
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Account Code</th>
                        <th>Account Name</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Transactions</th>
                        <th>Total Inflow</th>
                        <th>Total Outflow</th>
                        <th>Net Movement</th>
                        <th className="text-right">Ledger View</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountSummaryQuery.data.items.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-8 text-(--text-muted)">No accounts found.</td></tr>
                      ) : (
                        accountSummaryQuery.data.items.map((acc) => (
                          <tr key={acc.accountId}>
                            <td className="font-mono text-xs font-bold text-(--accent)">{acc.accountCode}</td>
                            <td className="font-medium text-xs">{acc.accountName}</td>
                            <td className="text-xs uppercase font-mono">{acc.accountType}</td>
                            <td>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                acc.isActive ? "badge-active" : "badge-closed"
                              }`}>
                                {acc.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="text-xs font-mono">{acc.transactionCount}</td>
                            <td className="text-xs text-emerald-600 font-semibold">{formatINR(acc.totalInflow)}</td>
                            <td className="text-xs text-blue-500 font-semibold">{formatINR(acc.totalOutflow)}</td>
                            <td className="text-xs font-bold text-(--text-primary)">{formatINR(acc.netMovement)}</td>
                            <td className="text-right">
                              <Link
                                href={`/account-ledger?accountId=${acc.accountId}`}
                                className="btn-secondary text-xs px-2.5 py-1"
                              >
                                View Ledger
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ==================== 8. DAY BOOK SUMMARY TAB ==================== */}
      {activeTab === "daybook" && (
        <div className="space-y-4">
          {dayBookSummaryQuery.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-(--accent)" /></div>
          ) : dayBookSummaryQuery.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Inflow</div>
                  <div className="text-2xl font-bold mt-1 text-emerald-600">
                    {formatINR(dayBookSummaryQuery.data.summary.totalInflow)}
                  </div>
                  <div className="text-xs text-(--text-muted) mt-1">{dayBookSummaryQuery.data.summary.paymentCount} payments</div>
                </div>

                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Outflow</div>
                  <div className="text-2xl font-bold mt-1 text-blue-500">
                    {formatINR(dayBookSummaryQuery.data.summary.totalOutflow)}
                  </div>
                  <div className="text-xs text-(--text-muted) mt-1">{dayBookSummaryQuery.data.summary.disbursementCount} disbursements</div>
                </div>

                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Net Cash Flow</div>
                  <div className="text-2xl font-bold mt-1 text-(--accent)">
                    {formatINR(dayBookSummaryQuery.data.summary.netCashFlow)}
                  </div>
                  <div className="text-xs text-(--text-muted) mt-1">Inflows - Outflows</div>
                </div>

                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Events</div>
                  <div className="text-2xl font-bold mt-1">
                    {dayBookSummaryQuery.data.summary.eventCount}
                  </div>
                  <div className="text-xs text-(--text-muted) mt-1">
                    {dayBookSummaryQuery.data.summary.closureCount} closures, {dayBookSummaryQuery.data.summary.itemReleaseCount} releases
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-between">
                <div className="text-xs text-(--text-muted)">
                  Want to inspect the detailed chronological Day Book entries?
                </div>
                <Link href="/day-book" className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Open Day Book View
                </Link>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ==================== 9. TRANSACTION HISTORY TAB ==================== */}
      {activeTab === "transactions" && (
        <div className="space-y-4">
          {transactionHistoryQuery.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-(--accent)" /></div>
          ) : transactionHistoryQuery.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Events</div>
                  <div className="text-xl font-bold mt-1">{transactionHistoryQuery.data.summary.totalTransactions}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Inflow</div>
                  <div className="text-xl font-bold mt-1 text-emerald-600">{formatINR(transactionHistoryQuery.data.summary.totalInflow)}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Total Outflow</div>
                  <div className="text-xl font-bold mt-1 text-blue-500">{formatINR(transactionHistoryQuery.data.summary.totalOutflow)}</div>
                </div>
                <div className="kpi-card">
                  <div className="text-xs text-(--text-muted)">Net Cash Movement</div>
                  <div className="text-xl font-bold mt-1 text-(--accent)">{formatINR(transactionHistoryQuery.data.summary.netMovement)}</div>
                </div>
              </div>

              <div className="glass-card overflow-hidden" style={{ borderColor: "var(--border-card)" }}>
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
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactionHistoryQuery.data.items.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-8 text-(--text-muted)">No ledger transactions found.</td></tr>
                      ) : (
                        transactionHistoryQuery.data.items.map((e) => (
                          <tr key={e.id}>
                            <td className="text-xs text-(--text-muted)">{formatDateTime(e.createdAt)}</td>
                            <td className="font-mono text-xs font-bold">{e.type}</td>
                            <td>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase inline-flex items-center gap-1 ${
                                  e.flow === "INFLOW"
                                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                    : e.flow === "OUTFLOW"
                                      ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                      : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                                }`}
                              >
                                {e.flow === "INFLOW" && <ArrowDownLeft className="w-3 h-3" />}
                                {e.flow === "OUTFLOW" && <ArrowUpRight className="w-3 h-3" />}
                                {e.flow}
                              </span>
                            </td>
                            <td className="font-bold text-xs">{formatINR(e.amount)}</td>
                            <td className="font-mono text-xs text-(--text-muted)">{formatINR(e.principalAfter)}</td>
                            <td className="font-mono text-xs font-medium">
                              <Link href={`/loans/${e.loanId}`} className="hover:underline text-(--accent)">
                                {e.loanNumber}
                              </Link>
                            </td>
                            <td>
                              <div className="font-medium text-xs">{e.customerName}</div>
                              <div className="text-[11px] font-mono text-(--text-muted)">{e.customerPhone}</div>
                            </td>
                            <td className="text-xs">
                              {e.accountCode ? (
                                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
                                  {e.accountCode} - {e.accountName}
                                </span>
                              ) : (
                                <span className="text-[11px] text-(--text-muted) italic">Unassigned (Legacy)</span>
                              )}
                            </td>
                            <td className="text-xs text-(--text-muted) max-w-xs truncate">{e.description}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
