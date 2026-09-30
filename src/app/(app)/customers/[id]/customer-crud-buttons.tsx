"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useUpdateCustomerDetailsMutation,
  useDeleteCustomerMutation,
} from "@/lib/redux/api/customersApi";
import { Edit2, Trash2, Loader2, AlertCircle, Save } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface CustomerCrudButtonsProps {
  customer: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  };
  canDelete: boolean;
}

export function CustomerCrudButtons({ customer, canDelete }: CustomerCrudButtonsProps) {
  const router = useRouter();
  const [updateCustomerDetails, { isLoading: updating }] = useUpdateCustomerDetailsMutation();
  const [deleteCustomer, { isLoading: deleting }] = useDeleteCustomerMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = updating || deleting;

  const [formData, setFormData] = useState({
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email || "",
    addressLine1: customer.addressLine1,
    city: customer.city,
    state: customer.state,
    pincode: customer.pincode,
  });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await updateCustomerDetails({ customerId: customer.id, data: formData });

    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to update customer details");
    } else {
      setEditOpen(false);
    }
  };

  const handleDelete = async () => {
    setError(null);

    const res = await deleteCustomer(customer.id);

    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to delete customer");
      setDeleteOpen(false);
    } else {
      setDeleteOpen(false);
      router.push("/customers");
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
          title="Edit Customer Details"
        >
          <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
          Edit Info
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
            title="Delete Customer Profile"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            Delete
          </Button>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg border-emerald-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-emerald-400" />
              Edit Customer Details
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone Number *</Label>
                <Input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Address Line 1 *</Label>
              <Input
                type="text"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>City *</Label>
                <Input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>State *</Label>
                <Input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Pincode *</Label>
                <Input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  className="font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-(--border-primary)">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Changes
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
              <span>Confirm Customer Deletion</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong className="text-(--text-primary)">{customer.fullName}</strong>? This action
              cannot be undone and will remove all KYC documents and history.
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
