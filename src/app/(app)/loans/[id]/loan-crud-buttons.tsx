"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeleteLoanMutation, useUpdateLoanNotesMutation } from "@/lib/redux/api/loansApi";
import { Trash2, Edit2, Loader2, AlertCircle, Save, FileText } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface LoanCrudButtonsProps {
  loanId: string;
  loanNumber: string;
  initialNotes: string | null;
  canDelete: boolean;
}

export function LoanCrudButtons({
  loanId,
  loanNumber,
  initialNotes,
  canDelete,
}: LoanCrudButtonsProps) {
  const router = useRouter();
  const [deleteLoan, { isLoading: deleting }] = useDeleteLoanMutation();
  const [updateLoanNotes, { isLoading: saving }] = useUpdateLoanNotesMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes || "");
  const [error, setError] = useState<string | null>(null);
  const loading = deleting || saving;

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
    </>
  );
}
