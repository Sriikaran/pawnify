"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Landmark,
  CheckCircle2,
  XCircle,
  Edit2,
  Filter,
  Loader2,
  AlertCircle,
  Shield,
  Layers,
  TrendingUp,
  TrendingDown,
  Coins,
  ShieldAlert,
  BookOpen,
  BookMarked,
} from "lucide-react";
import {
  createAccountAction,
  updateAccountAction,
  toggleAccountStatusAction,
  getAccountsAction,
} from "./actions";
import { AccountMasterWithCreator } from "@/lib/services/accounts";
import { AccountType } from "@prisma/client";

interface AccountsClientProps {
  userRole: string;
  initialAccounts: AccountMasterWithCreator[];
}

const ACCOUNT_TYPES: Array<{ type: AccountType; label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
  { type: "ASSET", label: "Asset", icon: Landmark, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  { type: "LIABILITY", label: "Liability", icon: TrendingDown, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  { type: "INCOME", label: "Income", icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  { type: "EXPENSE", label: "Expense", icon: Coins, color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  { type: "EQUITY", label: "Equity", icon: Layers, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
];

export function AccountsClient({ userRole, initialAccounts }: AccountsClientProps) {
  const isAdmin = userRole === "ADMIN";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [accounts, setAccounts] = useState<AccountMasterWithCreator[]>(initialAccounts);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  // Create Modal state (auto-opens if navigated with ?addAccount=true)
  const shouldAutoOpen = searchParams.get("addAccount") === "true";
  const [createOpen, setCreateOpen] = useState(shouldAutoOpen && isAdmin);
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<AccountType>("ASSET");
  const [createDesc, setCreateDesc] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Clean up ?addAccount=true from the URL so page refreshes don't re-trigger it
  useEffect(() => {
    if (searchParams.get("addAccount") === "true") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("addAccount");
      const newQuery = params.toString();
      const newUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  // Edit Modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountMasterWithCreator | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<AccountType>("ASSET");
  const [editDesc, setEditDesc] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Status toggle state
  const [statusModalAccount, setStatusModalAccount] = useState<AccountMasterWithCreator | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Filtered accounts
  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.code.toLowerCase().includes(search.toLowerCase()) ||
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      (acc.description && acc.description.toLowerCase().includes(search.toLowerCase()));

    const matchesType = typeFilter === "ALL" || acc.type === typeFilter;
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && acc.isActive) ||
      (statusFilter === "INACTIVE" && !acc.isActive);

    return matchesSearch && matchesType && matchesStatus;
  });

  // Summary counts
  const totalCount = accounts.length;
  const activeCount = accounts.filter((a) => a.isActive).length;
  const assetCount = accounts.filter((a) => a.type === "ASSET").length;
  const liabilityCount = accounts.filter((a) => a.type === "LIABILITY").length;
  const incomeCount = accounts.filter((a) => a.type === "INCOME").length;
  const expenseCount = accounts.filter((a) => a.type === "EXPENSE").length;

  const handleRefresh = async () => {
    const res = await getAccountsAction();
    if (res.success && res.accounts) {
      setAccounts(res.accounts);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    startTransition(async () => {
      const res = await createAccountAction({
        code: createCode,
        name: createName,
        type: createType,
        description: createDesc || null,
        isActive: true,
      });

      if (!res.success) {
        setCreateError(res.error || "Failed to create account.");
        return;
      }

      setCreateOpen(false);
      setCreateCode("");
      setCreateName("");
      setCreateDesc("");
      setCreateType("ASSET");
      await handleRefresh();
    });
  };

  const openEditModal = (acc: AccountMasterWithCreator) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditType(acc.type);
    setEditDesc(acc.description || "");
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditError(null);

    startTransition(async () => {
      const res = await updateAccountAction(editingAccount.id, {
        name: editName,
        type: editType,
        description: editDesc || null,
      });

      if (!res.success) {
        setEditError(res.error || "Failed to update account.");
        return;
      }

      setEditOpen(false);
      setEditingAccount(null);
      await handleRefresh();
    });
  };

  const handleToggleStatus = async () => {
    if (!statusModalAccount) return;
    setStatusError(null);

    startTransition(async () => {
      const res = await toggleAccountStatusAction(
        statusModalAccount.id,
        !statusModalAccount.isActive
      );

      if (!res.success) {
        setStatusError(res.error || "Failed to change status.");
        return;
      }

      setStatusModalAccount(null);
      await handleRefresh();
    });
  };

  const getTypeBadge = (type: AccountType) => {
    const meta = ACCOUNT_TYPES.find((t) => t.type === type);
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
          meta?.color || "text-gray-400 bg-gray-500/10 border-gray-500/20"
        }`}
      >
        {type}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Account Master"
        description="Master financial ledger accounts supporting Day Book, Cash/Bank books, and business-event accounting."
        action={
          isAdmin ? (
            <Button
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              className="gap-2 cursor-pointer font-semibold shadow-md"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </Button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-text)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <Shield className="w-3.5 h-3.5" />
              Staff View (Read-Only)
            </div>
          )
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          className="p-3.5 rounded-2xl border transition-all"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Total Accounts
          </span>
          <div className="text-xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
            {totalCount}
          </div>
          <span className="text-[11px] text-emerald-500 font-medium">
            {activeCount} active
          </span>
        </div>

        <div
          className="p-3.5 rounded-2xl border transition-all"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
        >
          <span className="text-xs font-medium text-blue-500">Assets</span>
          <div className="text-xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
            {assetCount}
          </div>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Cash, Bank, Loans
          </span>
        </div>

        <div
          className="p-3.5 rounded-2xl border transition-all"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
        >
          <span className="text-xs font-medium text-amber-500">Liabilities</span>
          <div className="text-xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
            {liabilityCount}
          </div>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Deposits, Borrowings
          </span>
        </div>

        <div
          className="p-3.5 rounded-2xl border transition-all"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
        >
          <span className="text-xs font-medium text-emerald-500">Income</span>
          <div className="text-xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
            {incomeCount}
          </div>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Interest, Fees
          </span>
        </div>

        <div
          className="p-3.5 rounded-2xl border transition-all"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
        >
          <span className="text-xs font-medium text-rose-500">Expenses</span>
          <div className="text-xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
            {expenseCount}
          </div>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Operational costs
          </span>
        </div>

        <div
          className="p-3.5 rounded-2xl border transition-all"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
        >
          <span className="text-xs font-medium text-purple-500">Equity</span>
          <div className="text-xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
            {accounts.filter((a) => a.type === "EQUITY").length}
          </div>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Capital & reserves
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="p-4 rounded-2xl border space-y-3"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
      >
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, account name, or description..."
              className="pl-9 rounded-xl"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-semibold mr-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <Filter className="w-3.5 h-3.5" /> Type:
            </span>
            {["ALL", "ASSET", "LIABILITY", "INCOME", "EXPENSE", "EQUITY"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  typeFilter === t
                    ? "bg-(--accent-bg) text-(--accent-text) border border-(--accent-border)"
                    : "text-(--text-muted) hover:text-(--text-primary) border border-transparent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold mr-1" style={{ color: "var(--text-muted)" }}>
              Status:
            </span>
            {["ALL", "ACTIVE", "INACTIVE"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === s
                    ? "bg-(--accent-bg) text-(--accent-text) border border-(--accent-border)"
                    : "text-(--text-muted) hover:text-(--text-primary) border border-transparent"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Accounts List Table */}
      <div
        className="rounded-2xl border overflow-hidden shadow-sm"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr
                style={{
                  background: "var(--bg-tertiary)",
                  borderBottom: "1px solid var(--border-primary)",
                  color: "var(--text-muted)",
                }}
              >
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Account Code</th>
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Account Name</th>
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Category</th>
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Description</th>
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Created By</th>
                <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border-primary)" }}>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="py-12 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Landmark className="w-8 h-8 opacity-40" />
                      <p className="font-medium text-sm">No accounts found.</p>
                      {isAdmin && (
                        <p className="text-xs">Click &quot;Add Account&quot; above to register your first master account.</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{
                      opacity: account.isActive ? 1 : 0.65,
                    }}
                  >
                    {/* Code */}
                    <td className="py-3.5 px-4 font-mono font-bold text-xs">
                      <span
                        className="px-2 py-1 rounded-md"
                        style={{
                          background: "var(--bg-tertiary)",
                          border: "1px solid var(--border-primary)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {account.code}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-3.5 px-4 font-semibold" style={{ color: "var(--text-primary)" }}>
                      {account.name}
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-4">
                      {getTypeBadge(account.type)}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 max-w-xs truncate" style={{ color: "var(--text-secondary)" }}>
                      {account.description || "—"}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {account.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
                          <XCircle className="w-3.5 h-3.5" /> Inactive
                        </span>
                      )}
                    </td>

                    {/* Created By */}
                    <td className="py-3.5 px-4 text-xs" style={{ color: "var(--text-muted)" }}>
                      {account.createdBy?.name || "System"}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/account-ledger?accountId=${account.id}`}
                          className="h-8 px-2.5 text-xs gap-1 inline-flex items-center rounded-lg font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer border border-emerald-500/30"
                          title="View Account Ledger for this account"
                        >
                          <BookMarked className="w-3.5 h-3.5" />
                          Ledger
                        </Link>
                        <Link
                          href={`/day-book?accountId=${account.id}`}
                          className="h-8 px-2.5 text-xs gap-1 inline-flex items-center rounded-lg font-medium text-(--accent) hover:bg-(--accent-bg) transition-colors cursor-pointer border border-(--accent-border)"
                          title="View Day Book for this account"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Day Book
                        </Link>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(account)}
                              className="h-8 px-2.5 text-xs gap-1 cursor-pointer"
                              title="Edit Account"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setStatusError(null);
                                setStatusModalAccount(account);
                              }}
                              className={`h-8 px-2.5 text-xs font-semibold cursor-pointer ${
                                account.isActive
                                  ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                                  : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                              }`}
                            >
                              {account.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className="sm:max-w-md rounded-2xl"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Landmark className="w-5 h-5 text-(--accent)" />
              Create Account Master
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                Account Code <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                placeholder="e.g. CASH-01, BANK-HDFC, INT-INC"
                className="font-mono rounded-xl"
                required
              />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Unique alphanumeric identifier. Uppercase, immutable once created.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                Account Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Primary Branch Cash Box, HDFC Current A/c"
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                Account Category <span className="text-rose-500">*</span>
              </Label>
              <select
                value={createType}
                onChange={(e) => setCreateType(e.target.value as AccountType)}
                className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none"
                style={{
                  background: "var(--bg-tertiary)",
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="ASSET">ASSET (Cash, Bank, Loan Portfolio)</option>
                <option value="LIABILITY">LIABILITY (Deposits, Borrowings)</option>
                <option value="INCOME">INCOME (Interest, Processing Fees)</option>
                <option value="EXPENSE">EXPENSE (Salaries, Rent, Operational)</option>
                <option value="EQUITY">EQUITY (Capital, Owner&apos;s Funds)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                Description (Optional)
              </Label>
              <Textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Optional purpose, bank branch details, or notes..."
                className="rounded-xl"
                rows={3}
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isPending}
                className="rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !createCode || !createName}
                className="rounded-xl cursor-pointer font-semibold gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="sm:max-w-md rounded-2xl"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Edit2 className="w-5 h-5 text-(--accent)" />
              Edit Account Master
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            {editError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                Account Code
              </Label>
              <Input
                value={editingAccount?.code || ""}
                disabled
                className="font-mono rounded-xl opacity-60 cursor-not-allowed"
              />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Account code is immutable to preserve historical ledger integrity.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                Account Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                Account Category <span className="text-rose-500">*</span>
              </Label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as AccountType)}
                className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none"
                style={{
                  background: "var(--bg-tertiary)",
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="ASSET">ASSET (Cash, Bank, Loan Portfolio)</option>
                <option value="LIABILITY">LIABILITY (Deposits, Borrowings)</option>
                <option value="INCOME">INCOME (Interest, Processing Fees)</option>
                <option value="EXPENSE">EXPENSE (Salaries, Rent, Operational)</option>
                <option value="EQUITY">EQUITY (Capital, Owner&apos;s Funds)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                Description
              </Label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="rounded-xl"
                rows={3}
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={isPending}
                className="rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !editName}
                className="rounded-xl cursor-pointer font-semibold gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* TOGGLE STATUS CONFIRMATION MODAL */}
      <Dialog
        open={Boolean(statusModalAccount)}
        onOpenChange={(open) => !open && setStatusModalAccount(null)}
      >
        <DialogContent
          className="sm:max-w-md rounded-2xl"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              {statusModalAccount?.isActive ? "Deactivate Account" : "Activate Account"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {statusError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Are you sure you want to {statusModalAccount?.isActive ? "deactivate" : "activate"}{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {statusModalAccount?.name} ({statusModalAccount?.code})
              </strong>
              ?
            </p>

            {statusModalAccount?.isActive ? (
              <div
                className="p-3 rounded-xl text-xs space-y-1"
                style={{
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-muted)",
                }}
              >
                <p className="font-semibold text-amber-500">Historical Data Preservation:</p>
                <p>
                  Deactivating this account will NOT delete it or affect past transactions.
                  However, it will prevent this account from being newly selected for future financial transactions.
                </p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Activating this account will make it available again for future financial transactions.
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStatusModalAccount(null)}
              disabled={isPending}
              className="rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleToggleStatus}
              disabled={isPending}
              className={`rounded-xl cursor-pointer font-semibold gap-2 ${
                statusModalAccount?.isActive
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {statusModalAccount?.isActive ? "Confirm Deactivation" : "Confirm Activation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
