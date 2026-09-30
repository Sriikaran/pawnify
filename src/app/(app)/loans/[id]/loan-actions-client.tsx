"use client";

import React, { useState } from "react";
import confetti from "canvas-confetti";
import {
  useRecordPaymentMutation,
  useCloseLoanMutation,
  useReleaseItemsMutation,
} from "@/lib/redux/api/loansApi";
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Unlock,
  Printer,
  X,
  TrendingDown,
  Coins,
  ShieldCheck,
  Calendar,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PaymentModalProps {
  loanId: string;
  principalOutstanding: number;
  accruedInterest: number;
  unsettledCharges: number;
  totalDue: number;
}

export function RecordPaymentModal({
  loanId,
  principalOutstanding,
  accruedInterest,
  unsettledCharges,
  totalDue,
}: PaymentModalProps) {
  const [recordPayment, { isLoading: loading }] = useRecordPaymentMutation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [amountPaid, setAmountPaid] = useState<number>(
    Math.ceil(accruedInterest + unsettledCharges)
  );
  const [mode, setMode] = useState<"CASH" | "UPI" | "BANK_TRANSFER" | "CARD">("UPI");
  const [notes, setNotes] = useState("");

  const handleOpen = () => {
    setAmountPaid(Math.ceil(totalDue > 0 ? totalDue : 100));
    setError(null);
    setSuccessMsg(null);
    setOpen(true);
  };

  const calculatePreview = (paid: number) => {
    let rem = paid;
    const allocCharges = Math.min(rem, unsettledCharges);
    rem -= allocCharges;
    const allocInterest = Math.min(rem, accruedInterest);
    rem -= allocInterest;
    const allocPrincipal = Math.min(rem, principalOutstanding);
    return { allocCharges, allocInterest, allocPrincipal };
  };

  const preview = calculatePreview(amountPaid || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountPaid <= 0) {
      setError("Payment amount must be greater than zero");
      return;
    }
    setError(null);

    const res = await recordPayment({ loanId, amountPaid, mode, notes });

    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Payment recording failed");
    } else {
      setSuccessMsg("Payment Recorded Successfully!");
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10B981", "#34D399", "#059669"],
      });
      setTimeout(() => {
        setOpen(false);
      }, 1200);
    }
  };

  const formatINR = (num: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={handleOpen} className="shadow-md shadow-amber-500/10">
          <Wallet className="w-4 h-4 mr-2" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg border-(--accent-border)">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-(--accent-bg) text-(--accent) flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <span>Record Loan Repayment</span>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-(--accent-text) text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-(--accent) shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="p-4 rounded-xl bg-(--bg-tertiary) border border-(--border-primary) space-y-2 text-xs">
            <div className="font-semibold text-(--text-secondary) uppercase tracking-wider text-[11px] mb-2">
              Current Outstanding Breakdown
            </div>
            <div className="flex justify-between text-(--text-secondary)">
              <span>Unsettled Fees/Charges:</span>
              <span className="font-mono text-(--text-primary)">{formatINR(unsettledCharges)}</span>
            </div>
            <div className="flex justify-between text-(--text-secondary)">
              <span>Accrued Simple Interest:</span>
              <span className="font-mono text-(--accent) font-semibold">
                {formatINR(accruedInterest)}
              </span>
            </div>
            <div className="flex justify-between text-(--text-secondary)">
              <span>Principal Outstanding:</span>
              <span className="font-mono text-(--text-primary)">
                {formatINR(principalOutstanding)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-(--border-primary) text-sm font-bold text-(--text-primary)">
              <span>Total Dues:</span>
              <span className="font-mono text-(--accent)">{formatINR(totalDue)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="amount">Amount Paying *</Label>
                <button
                  type="button"
                  onClick={() => setAmountPaid(Math.ceil(totalDue))}
                  className="text-[10px] text-(--accent) font-semibold hover:underline cursor-pointer"
                >
                  Pay Full (₹{Math.ceil(totalDue)})
                </button>
              </div>
              <Input
                id="amount"
                type="number"
                step="any"
                min="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                className="font-mono text-lg font-bold text-(--accent) py-2.5 h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Payment Mode *</Label>
              <select
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as "CASH" | "UPI" | "BANK_TRANSFER" | "CARD")
                }
                className="flex h-11 w-full rounded-md border border-input bg-(--bg-input) px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="UPI" className="bg-(--bg-input) text-(--text-primary)">
                  UPI / Instant Transfer
                </option>
                <option value="CASH" className="bg-(--bg-input) text-(--text-primary)">
                  Cash at Counter
                </option>
                <option value="BANK_TRANSFER" className="bg-(--bg-input) text-(--text-primary)">
                  Bank NEFT / RTGS
                </option>
                <option value="CARD" className="bg-(--bg-input) text-(--text-primary)">
                  Debit / Credit Card
                </option>
              </select>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-(--bg-tertiary) border border-(--border-primary) space-y-1.5 text-xs">
            <div className="text-[11px] font-semibold text-(--text-secondary) uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-(--accent)" />
              Atomic Waterfall Allocation Preview (§6.4)
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
              <div className="p-2 rounded bg-(--bg-card) border border-(--border-primary)">
                <div className="text-[10px] text-(--text-muted) font-sans">1. Charges</div>
                <div className="font-semibold text-(--text-primary)">
                  {formatINR(preview.allocCharges)}
                </div>
              </div>
              <div className="p-2 rounded bg-(--bg-card) border border-(--border-primary)">
                <div className="text-[10px] text-(--text-muted) font-sans">2. Interest</div>
                <div className="font-semibold text-(--accent)">
                  {formatINR(preview.allocInterest)}
                </div>
              </div>
              <div className="p-2 rounded bg-(--bg-card) border border-(--border-primary)">
                <div className="text-[10px] text-(--text-muted) font-sans">3. Principal</div>
                <div className="font-semibold text-(--accent)">
                  {formatINR(preview.allocPrincipal)}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Reference / Notes (Optional)</Label>
            <Input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. UPI Ref: 318920481234"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-(--border-primary)">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || amountPaid <= 0}
              className="shadow-lg shadow-emerald-500/10 bg-(--accent) hover:opacity-90 text-(--text-inverse)"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                "Issue Receipt & Settle"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CloseLoanProps {
  loanId: string;
  canClose: boolean;
  reason?: string;
}

export function CloseLoanButton({ loanId, canClose, reason }: CloseLoanProps) {
  const [closeLoan, { isLoading: loading }] = useCloseLoanMutation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = async () => {
    setError(null);

    const res = await closeLoan(loanId);
    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to close loan");
      return;
    }

    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.5 },
      colors: ["#FACC15", "#EAB308", "#10B981"],
    });
    setOpen(false);
  };

  if (!canClose) {
    return (
      <Button
        disabled
        variant="secondary"
        size="sm"
        title={reason || "Settle all dues before closing"}
        className="opacity-50 cursor-not-allowed text-xs"
      >
        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
        Close Loan Contract
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        disabled={loading}
        className="border-(--accent-border) text-(--accent) hover:bg-(--accent-bg) text-xs"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            Closing...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Close Loan Contract
          </>
        )}
      </Button>
      {error && <div className="text-red-400 text-[11px] mt-1">{error}</div>}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-(--accent-border)">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-(--accent)">
              <CheckCircle2 className="w-5 h-5" />
              <span>Confirm Loan Closure</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to financially close this loan contract? This confirms all
              principal and interest dues are settled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOpen(false)}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="bg-(--accent) hover:opacity-90 text-(--text-inverse) font-bold flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Yes, Close Contract
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ReleaseItemsProps {
  loanId: string;
  isClosed: boolean;
  isReleased: boolean;
}

export function ReleaseItemsButton({ loanId, isClosed, isReleased }: ReleaseItemsProps) {
  const [releaseItems, { isLoading: loading }] = useReleaseItemsMutation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRelease = async () => {
    setError(null);

    const res = await releaseItems(loanId);
    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to release items");
      return;
    }

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#34D399", "#10B981", "#059669"],
    });
    setOpen(false);
  };

  if (isReleased) {
    return (
      <span className="badge-verified text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-semibold">
        <ShieldCheck className="w-4 h-4" />
        Collateral Released
      </span>
    );
  }

  if (!isClosed) {
    return (
      <Button
        disabled
        variant="secondary"
        size="sm"
        title="Loan must be financially closed before releasing items"
        className="opacity-50 cursor-not-allowed text-xs"
      >
        <Unlock className="w-3.5 h-3.5 mr-1.5" />
        Release Collateral Items
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        disabled={loading}
        className="bg-(--accent) hover:opacity-90 text-(--text-inverse) shadow-md shadow-emerald-500/10 text-xs"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            Releasing...
          </>
        ) : (
          <>
            <Unlock className="w-3.5 h-3.5 mr-1.5" />
            Release Collateral Items
          </>
        )}
      </Button>
      {error && <div className="text-red-400 text-[11px] mt-1">{error}</div>}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-(--accent-border)">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-(--accent)">
              <Unlock className="w-5 h-5" />
              <span>Confirm Collateral Hand-back</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Confirm physical hand-back of all pledged collateral items to the customer? This marks
              the collateral as officially returned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOpen(false)}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              onClick={handleRelease}
              disabled={loading}
              className="bg-(--accent) hover:opacity-90 text-(--text-inverse) font-bold flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm Release
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PawnTicketPrintButton() {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => window.print()}
      title="Print Pawn Ticket / Loan Summary"
      className="text-xs"
    >
      <Printer className="w-3.5 h-3.5 text-(--text-secondary) mr-1.5" />
      Print Pawn Ticket
    </Button>
  );
}

export function ItemPhotoPreview({
  photoUrl,
  description,
}: {
  photoUrl?: string | null;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  if (!photoUrl) return <span className="text-[10px] text-(--text-muted) font-mono">No photo</span>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-(--accent-bg) border border-(--accent-border) text-(--accent) hover:bg-(--accent-bg-hover) transition-all text-xs cursor-pointer font-medium"
        >
          <FileText className="w-3.5 h-3.5" />
          View Photo
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl border-(--accent-border) p-4">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-(--text-primary)">
            {description} - Collateral Photo
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center max-h-[70vh] overflow-hidden rounded-xl bg-black">
          <img src={photoUrl} alt={description} className="object-contain max-h-[70vh] w-auto" />
        </div>
        <div className="flex justify-end pt-1">
          <a
            href={photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Open Full Resolution
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
