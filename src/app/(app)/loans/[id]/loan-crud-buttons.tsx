"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useDeleteLoanMutation,
  useUpdateLoanNotesMutation,
  useCancelDisbursedLoanMutation,
} from "@/lib/redux/api/loansApi";
import { Trash2, Edit2, Loader2, AlertCircle, Save, FileText, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface LoanCrudButtonsProps {
  loanId: string;
  loanNumber: string;
  initialNotes: string | null;
  canDelete: boolean;
  status?: string;
}

export function LoanCrudButtons({
  loanId,
  loanNumber,
  initialNotes,
  canDelete,
  status = "ACTIVE",
}: LoanCrudButtonsProps) {
  const router = useRouter();
  const [deleteLoan, { isLoading: deleting }] = useDeleteLoanMutation();
  const [updateLoanNotes, { isLoading: saving }] = useUpdateLoanNotesMutation();
  const [cancelLoan, { isLoading: cancelling }] = useCancelDisbursedLoanMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [notes, setNotes] = useState(initialNotes || "");
  const [error, setError] = useState<string | null>(null);
  const loading = deleting || saving || cancelling;

  const handleCancelLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setError("Please provide a reason for cancelling this loan");
      return;
    }
    setError(null);
    const res = await cancelLoan({ loanId, reason: cancelReason });
    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to cancel loan");
    } else {
      setCancelOpen(false);
      router.refresh();
    }
  };

  const handleDelete = async () => {
    setError(null);
    const res = await deleteLoan(loanId);
    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to delete loan");
    } else {
      setDeleteOpen(false);
      router.push("/loans");
    }
  };

  const handleUpdateNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await updateLoanNotes({ loanId, notes });
    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to update loan notes");
    } else {
      setEditOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setEditOpen(true);
            setError(null);
          }}
          className="hover:border-emerald-500/40"
          title="Edit Loan Notes"
        >
          <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
          Edit Notes
        </Button>
        {status === "ACTIVE" && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setCancelOpen(true);
              setCancelReason("");
              setError(null);
            }}
            className="hover:border-amber-500/40 text-amber-500 text-xs"
            title="Cancel Disbursed Loan"
          >
            <Ban className="w-3.5 h-3.5 text-amber-500" />
            Cancel Loan
          </Button>
        )}
        {canDelete && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setDeleteOpen(true);
              setError(null);
            }}
            className="hover:border-red-500/40 text-red-400"
            title="Delete Loan Record"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            Delete Loan
          </Button>
        )}
      </div>

      {/* Edit Notes Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-emerald-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Edit Loan Notes ({loanNumber})
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUpdateNotes} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label>Internal Appraisal / Loan Notes</Label>
              <Textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter confidential remarks, item condition details, or repayment reminders..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Notes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-red-500/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-red-400">
              <Trash2 className="w-5 h-5" />
              <span>Confirm Loan Deletion</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete loan{" "}
              <strong className="text-(--text-primary)">{loanNumber}</strong>? This action will
              remove all recorded payments, charges, collateral items, and ledger entries associated
              with this loan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="font-bold flex items-center gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete Forever
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Disbursed Loan Modal */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="border-amber-500/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Ban className="w-5 h-5 text-amber-500" />
              <span>Cancel Disbursed Loan ({loanNumber})</span>
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCancelLoan} className="space-y-4 text-xs">
            <p className="text-(--text-secondary) leading-relaxed">
              Cancelling a disbursed loan marks it as closed and records a reversal transaction in the
              accounting ledger. Collateral items will be released. All historical payment and ledger
              records remain permanently preserved.
            </p>

            <div className="space-y-1.5">
              <Label>Cancellation Reason *</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Disbursed in error / customer requested immediate reversal"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-(--border-primary)">
              <Button type="button" variant="secondary" onClick={() => setCancelOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !cancelReason.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Confirm Cancellation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
