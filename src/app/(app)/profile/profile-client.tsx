"use client";

import React, { useState, useRef } from "react";
import {
  useUpdateProfileNameMutation,
  useUpdateProfileAvatarMutation,
} from "@/lib/redux/api/profileApi";
import { DocumentUploader } from "@/components/document-uploader";
import axios from "axios";
import {
  User,
  Mail,
  ShieldCheck,
  Building2,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Key,
  Camera,
  Upload,
} from "lucide-react";

interface ProfileClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    image?: string;
  };
}

export function ProfileClient({ user }: ProfileClientProps) {
  const [updateProfileName, { isLoading: loading }] = useUpdateProfileNameMutation();
  const [updateProfileAvatar] = useUpdateProfileAvatarMutation();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`pawnify_avatar_${user.id}`);
      if (saved) return saved;
    }
    return user.image || null;
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const displayAvatarUrl = avatarUrl ?? user.image ?? null;

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setAvatarUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "pawnify-avatars");

      const res = await axios.post("/api/storage/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const newUrl = res.data.url;
      if (newUrl) {
        setAvatarUrl(newUrl);
        if (typeof window !== "undefined") {
          localStorage.setItem(`pawnify_avatar_${user.id}`, newUrl);
        }
        const avatarRes = await updateProfileAvatar(newUrl);
        if ("error" in avatarRes) {
          setError((avatarRes.error as { message?: string })?.message || "Failed to update avatar");
        }
      }
    } catch (err: unknown) {
      let msg = "Failed to upload avatar";
      if (axios.isAxiosError(err)) {
        msg = err.response?.data?.error || err.message;
      }
      setError(msg);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append("name", name);

    const res = await updateProfileName(formData);

    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to update profile");
    } else {
      setSuccess(true);
    }
  };

  const handleSimulatedPwdChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdLoading(true);
    setPwdSuccess(false);
    setTimeout(() => {
      setPwdLoading(false);
      setPwdSuccess(true);
    }, 800);
  };

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto font-sans">
      {/* Profile Header Card */}
      <div className="glass-card p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 border border-(--border-primary) bg-(--bg-card) shadow-lg">
        <div className="relative group shrink-0">
          <div className="w-20 h-20 rounded-2xl bg-(--accent) flex items-center justify-center text-(--text-inverse) text-3xl font-black shadow-lg shadow-emerald-500/20 overflow-hidden border border-(--border-primary)">
            {displayAvatarUrl ? (
              <img src={displayAvatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            className="absolute inset-0 bg-(--bg-overlay) rounded-2xl flex flex-col items-center justify-center text-(--text-inverse) opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-semibold gap-1"
            title="Change Avatar"
          >
            {avatarUploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-(--accent)" />
            ) : (
              <>
                <Camera className="w-5 h-5 text-(--accent)" />
                <span>Change</span>
              </>
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarSelect}
            className="hidden"
          />
        </div>

        <div className="text-center sm:text-left flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-2xl font-black text-(--text-primary) truncate">{name}</h1>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full w-fit mx-auto sm:mx-0"
              style={
                user.role === "ADMIN"
                  ? {
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "#22c55e",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                    }
                  : {
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#3b82f6",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                    }
              }
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {user.role} Account
            </span>
          </div>
          <p className="text-sm text-(--text-secondary) mt-1 font-mono">{user.email}</p>
          <div className="flex items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-(--text-secondary) font-medium">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-(--accent)" />
              Branch: Mumbai Main Vault (#HQ-01)
            </span>
            <span className="text-(--accent) font-mono">● Active Session</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarUploading}
          className="btn-secondary text-xs px-3 py-1.5 self-center sm:self-start flex items-center gap-1.5"
        >
          {avatarUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          <span>Upload Avatar</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-(--accent) text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Profile information updated successfully!</span>
        </div>
      )}

      {/* Edit Profile Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-(--border-primary)">
            <User className="w-5 h-5 text-(--accent)" />
            <h2 className="text-base font-bold text-(--text-primary)">Basic Information</h2>
          </div>

          <form onSubmit={handleUpdateName} className="space-y-4">
            <div>
              <label className="input-label" htmlFor="name">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field w-full"
                required
              />
            </div>

            <div>
              <label className="input-label" htmlFor="email">
                Email Address (Read-Only)
              </label>
              <input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="input-field w-full opacity-60 cursor-not-allowed bg-(--bg-tertiary) text-(--text-primary)"
              />
              <span className="text-[11px] text-(--text-muted) mt-1 block">
                Contact your System Administrator to change institutional email.
              </span>
            </div>

            <div>
              <label className="input-label">Assigned Role & RBAC Tier</label>
              <div className="p-3 rounded-xl bg-(--bg-tertiary) border border-(--border-primary) text-xs font-semibold text-(--text-primary) flex items-center justify-between">
                <span>
                  {user.role} —{" "}
                  {user.role === "ADMIN"
                    ? "Full System & LTV Access"
                    : "Loan & KYC Processing Access"}
                </span>
                <span className="text-(--accent) font-mono">Verified</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || name === user.name}
              className="btn-primary w-full py-2.5 text-xs font-bold cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-(--border-primary)">
            <Key className="w-5 h-5 text-(--accent)" />
            <h2 className="text-base font-bold text-(--text-primary)">Security & Credentials</h2>
          </div>

          {pwdSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-(--accent) text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Password updated successfully!</span>
            </div>
          )}

          <form onSubmit={handleSimulatedPwdChange} className="space-y-4">
            <div>
              <label className="input-label" htmlFor="curPwd">
                Current Password
              </label>
              <input
                id="curPwd"
                type="password"
                placeholder="••••••••••••"
                className="input-field w-full"
                required
              />
            </div>

            <div>
              <label className="input-label" htmlFor="newPwd">
                New Password
              </label>
              <input
                id="newPwd"
                type="password"
                placeholder="••••••••••••"
                className="input-field w-full"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="confPwd">
                Confirm New Password
              </label>
              <input
                id="confPwd"
                type="password"
                placeholder="••••••••••••"
                className="input-field w-full"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={pwdLoading}
              className="btn-secondary w-full py-2.5 text-xs font-bold cursor-pointer mt-2 flex items-center justify-center gap-2"
            >
              {pwdLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Supabase Storage Card for Staff Documents */}
      <div className="glass-card p-6 sm:p-8 space-y-4 border border-(--border-primary)">
        <DocumentUploader
          label="Upload Official Staff Documents & Profile Attachments (ID Proof / Digital Signature / Avatar)"
          bucket="pawnify-staff-docs"
          localStorageKey={`pawnify_profile_docs_${user.id}`}
        />
      </div>
    </div>
  );
}
