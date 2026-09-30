"use client";

import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  useCreateStaffUserMutation,
  useUpdateStaffStatusMutation,
  useUpdateStaffUserMutation,
  useDeleteStaffUserMutation,
} from "@/lib/redux/api/staffApi";
import {
  Plus,
  ShieldCheck,
  UserCheck,
  UserX,
  Loader2,
  AlertCircle,
  Lock,
  Mail,
  User,
  Edit2,
  Trash2,
  MoreVertical,
  Phone,
  KeyRound,
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
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AddStaffModal() {
  const [createStaffUser, { isLoading: loading }] = useCreateStaffUserMutation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("password123");
  const [hiddenPassword, setHiddenPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await createStaffUser({
      name,
      email,
      phone,
      password,
      hiddenPassword: hiddenPassword.trim() || undefined,
      role,
    });
    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to create user");
      return;
    }

    setName("");
    setEmail("");
    setPhone("");
    setPassword("password123");
    setHiddenPassword("");
    setRole("STAFF");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
          className="shadow-md shadow-amber-500/10"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
        </Button>
      </DialogTrigger>
      <DialogContent className="border-(--accent-border)">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-(--accent)" />
            <span>Create New Staff / Admin Account</span>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-(--text-secondary)" />
              Full Name *
            </Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-(--text-secondary)" />
              Email Address *
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ramesh@pawnify.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-(--text-secondary)" />
              Mobile Number (10 Digits) *
            </Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              maxLength={10}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-(--text-secondary)" />
              Normal Password (100% Display) *
            </Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-500" />
              Hidden Password (50% Display, Optional)
            </Label>
            <Input
              type="text"
              value={hiddenPassword}
              onChange={(e) => setHiddenPassword(e.target.value)}
              placeholder="Leave blank or enter alternate password"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Role Permissions *</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}
              className="flex h-10 w-full rounded-md border border-input bg-(--bg-input) px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="STAFF" className="bg-(--bg-input) text-(--text-primary)">
                STAFF — Can register customers & disburse loans
              </option>
              <option value="ADMIN" className="bg-(--bg-input) text-(--text-primary)">
                ADMIN — Full system access & staff management
              </option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditStaffUserModal({
  user,
  isSelf,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  isSelf: boolean;
}) {
  const [updateStaffUser, { isLoading: loading }] = useUpdateStaffUserMutation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<"ADMIN" | "STAFF">(user.role as "ADMIN" | "STAFF");
  const [isActive, setIsActive] = useState(user.isActive);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await updateStaffUser({ userId: user.id, data: { name, email, role, isActive } });
    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to update staff user");
    } else {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
          title="Edit Staff Account & Roles"
          className="hover:border-(--accent-border) hover:text-(--accent) text-(--text-secondary)"
        >
          <Edit2 className="w-3.5 h-3.5 text-(--accent)" />
          Edit Role
        </Button>
      </DialogTrigger>
      <DialogContent className="border-(--accent-border)">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-(--accent)" />
            <span>Edit Staff Details & Role</span>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-(--text-secondary)" />
              Full Name *
            </Label>
            <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-(--text-secondary)" />
              Work Email Address *
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-mono"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Role Assignment *</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}
              disabled={isSelf}
              className="flex h-10 w-full rounded-md border border-input bg-(--bg-input) px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="STAFF" className="bg-(--bg-input) text-(--text-primary)">
                STAFF — Can register customers & disburse loans
              </option>
              <option value="ADMIN" className="bg-(--bg-input) text-(--text-primary)">
                ADMIN — Full system access & staff management
              </option>
            </select>
            {isSelf && (
              <p className="text-[10px] text-(--accent)/80 mt-1">
                You cannot demote your own active admin account.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Account Status</Label>
            <select
              value={isActive ? "active" : "inactive"}
              onChange={(e) => setIsActive(e.target.value === "active")}
              disabled={isSelf}
              className="flex h-10 w-full rounded-md border border-input bg-(--bg-input) px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="active" className="bg-(--bg-input) text-(--text-primary)">
                Active — Account can log in and process transactions
              </option>
              <option value="inactive" className="bg-(--bg-input) text-(--text-primary)">
                Inactive — Account is locked and cannot log in
              </option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ToggleUserStatusButton({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [updateStaffStatus, { isLoading: loading }] = useUpdateStaffStatusMutation();
  const [open, setOpen] = useState(false);

  const toggle = async () => {
    if (isSelf) return;
    await updateStaffStatus({ userId, isActive: !isActive });
    setOpen(false);
  };

  if (isSelf) {
    return <span className="text-[10px] text-(--text-muted) italic">Current user</span>;
  }

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-(--accent)" />;
  }

  return (
    <>
      {isActive ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          title="Deactivate Account"
          className="hover:border-red-500/40 hover:text-red-400"
        >
          <UserX className="w-3.5 h-3.5 text-red-400" />
          Deactivate
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          title="Reactivate Account"
          className="hover:border-(--accent-border) hover:text-(--accent) text-(--text-secondary)"
        >
          <UserCheck className="w-3.5 h-3.5 text-(--accent)" />
          Reactivate
        </Button>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className={isActive ? "border-red-500/40" : "border-(--accent-border)"}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-(--text-primary)">
              {isActive ? (
                <UserX className="w-5 h-5 text-red-400" />
              ) : (
                <UserCheck className="w-5 h-5 text-(--accent)" />
              )}
              <span>Confirm Status Change</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {isActive ? "deactivate" : "reactivate"} this user account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOpen(false)}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant={isActive ? "destructive" : "default"}
              onClick={toggle}
              disabled={loading}
              className="font-bold flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Yes, {isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function DeleteStaffUserButton({
  userId,
  isSelf,
  userName,
}: {
  userId: string;
  isSelf: boolean;
  userName: string;
}) {
  const [deleteStaffUser, { isLoading: loading }] = useDeleteStaffUserMutation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isSelf) return null;

  const handleDelete = async () => {
    setError(null);
    const res = await deleteStaffUser(userId);
    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to delete staff account");
    } else {
      setOpen(false);
    }
  };

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-red-400" />;
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        title="Delete Staff Account"
        className="p-1.5 rounded-lg text-(--text-muted) hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-red-500/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              <span>Confirm Account Deletion</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete staff account (
              <strong className="text-(--text-primary)">{userName}</strong>)? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOpen(false)}>Cancel</AlertDialogCancel>
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
              Delete Account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function StaffActionsMenu({
  user,
  isSelf,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  isSelf: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = () => {
    if (!menuOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setMenuOpen(!menuOpen);
  };

  return (
    <div className="relative inline-block text-right">
      <button
        ref={btnRef}
        type="button"
        onClick={toggleMenu}
        className="p-1 rounded-lg transition-colors cursor-pointer"
        style={{ color: "var(--text-secondary)" }}
        title="More Access Options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setMenuOpen(false)} />
            <div
              className="fixed z-[9999] w-48 rounded-xl shadow-2xl py-1.5 text-left animate-fadeIn"
              style={{
                top: coords.top,
                right: coords.right,
                background: "var(--bg-card)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setEditOpen(true);
                }}
                className="w-full px-3.5 py-2 text-xs flex items-center gap-2 transition-colors cursor-pointer hover:opacity-80"
                style={{ color: "var(--text-primary)" }}
              >
                <Edit2 className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />
                <span>Edit Role & Info</span>
              </button>

              <div className="my-1" style={{ borderTop: "1px solid var(--border-secondary)" }} />

              <div className="px-3.5 py-1.5 flex items-center justify-between">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Status:
                </span>
                <ToggleUserStatusButton userId={user.id} isActive={user.isActive} isSelf={isSelf} />
              </div>

              {!isSelf && (
                <>
                  <div
                    className="my-1"
                    style={{ borderTop: "1px solid var(--border-secondary)" }}
                  />
                  <div className="px-3.5 py-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-red-500 font-medium">Delete:</span>
                    <DeleteStaffUserButton userId={user.id} isSelf={isSelf} userName={user.name} />
                  </div>
                </>
              )}
            </div>
          </>,
          document.body
        )}

      {/* Embedded Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-(--accent-border)">
          <EditModalContent user={user} isSelf={isSelf} onClose={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditModalContent({
  user,
  isSelf,
  onClose,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  isSelf: boolean;
  onClose: () => void;
}) {
  const [updateStaffUser, { isLoading: loading }] = useUpdateStaffUserMutation();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<"ADMIN" | "STAFF">(user.role as "ADMIN" | "STAFF");
  const [isActive, setIsActive] = useState(user.isActive);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await updateStaffUser({ userId: user.id, data: { name, email, role, isActive } });
    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to update staff user");
    } else {
      onClose();
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit2 className="w-4 h-4 text-(--accent)" />
          <span>Edit Staff Account & Permissions</span>
        </DialogTitle>
      </DialogHeader>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-(--text-secondary)" />
            Full Name *
          </Label>
          <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-(--text-secondary)" />
            Work Email Address *
          </Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="font-mono"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Role Assignment *</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}
            disabled={isSelf}
            className="flex h-10 w-full rounded-md border border-input bg-(--bg-input) px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="STAFF" className="bg-(--bg-input) text-(--text-primary)">
              STAFF — Can register customers & disburse loans
            </option>
            <option value="ADMIN" className="bg-(--bg-input) text-(--text-primary)">
              ADMIN — Full system access & staff management
            </option>
          </select>
          {isSelf && (
            <p className="text-[10px] text-(--accent)/80 mt-1">
              You cannot demote your own active admin account.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Account Status</Label>
          <select
            value={isActive ? "active" : "inactive"}
            onChange={(e) => setIsActive(e.target.value === "active")}
            disabled={isSelf}
            className="flex h-10 w-full rounded-md border border-input bg-(--bg-input) px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="active" className="bg-(--bg-input) text-(--text-primary)">
              Active — Account can log in and process transactions
            </option>
            <option value="inactive" className="bg-(--bg-input) text-(--text-primary)">
              Inactive — Account is locked and cannot log in
            </option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
