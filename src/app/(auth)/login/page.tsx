"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useTheme } from "@/components/theme-provider";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone || !password) {
      setError("Please fill in all required fields");
      return;
    }

    const digits = phone.replace(/\D/g, "");
    const cleanPhone =
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/sign-in/mobile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: cleanPhone,
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid mobile number or password");
        setLoading(false);
        return;
      }

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#16a34a", "#4ade80"],
      });

      router.push(callbackUrl);
      router.refresh();
    } catch (err: unknown) {
      console.error("Auth error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const fillDemo = (demoPhone: string) => {
    setPhone(demoPhone);
    setPassword("password123");
    setError(null);
  };

  return (
    <div
      className="min-h-screen w-full flex relative overflow-hidden font-sans"
      style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}
    >
      {/* Subtle Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 p-2.5 rounded-full transition-all duration-200 hover:scale-105 cursor-pointer shadow-md flex items-center justify-center"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-primary)",
          color: "var(--text-primary)",
        }}
        aria-label="Toggle theme"
      >
        {theme === "light" ? (
          <Moon className="w-4 h-4" />
        ) : (
          <Sun className="w-4 h-4 text-(--accent)" />
        )}
      </button>

      {/* LEFT PANEL — Minimalist Institutional Canvas */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 lg:p-16 overflow-hidden bg-gradient-to-br from-zinc-950 via-[#0a100c] to-[#041209] text-white border-r border-white/[0.08] select-none">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Sleek Minimalist Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#22c55e08_1px,transparent_1px),linear-gradient(to_bottom,#22c55e08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/icon.png" alt="Pawnify" className="w-9 h-9 object-contain" />
          <span className="text-2xl font-black tracking-tight text-white font-sans">PAWNIFY</span>
        </div>

        {/* Minimalist Editorial Content */}
        <div className="relative z-10 max-w-md my-auto space-y-8">
          {/* Live Market Ticker Card */}
          <div className="inline-flex items-center gap-4 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>GOLD 24K: ₹7,850/g</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                +0.4%
              </span>
            </div>
            <div className="w-[1px] h-3 bg-white/10" />
            <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-300">
              <span>SILVER: ₹92/g</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                +1.2%
              </span>
            </div>
          </div>

          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            The operational standard for asset lending.
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed font-normal">
            Built for institutional pawnbrokers. Seamlessly calculate LTV margins, verify Aadhaar
            identities, and issue automated loan agreements in seconds.
          </p>

          <div className="pt-2 flex items-center gap-6 text-xs text-zinc-400 font-medium">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>RBI Tier 1–3 Slabs</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>UIDAI Verified KYC</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>256-bit Vault Security</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-zinc-500 border-t border-white/[0.08] pt-6">
          <span>© 2026 Pawnify India Pvt. Ltd.</span>
          <span className="flex items-center gap-1.5 text-zinc-400 font-mono">
            <span>Mumbai · Bangalore · Delhi</span>
          </span>
        </div>
      </div>

      {/* RIGHT PANEL — Clean Form Section */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 lg:p-16 relative overflow-y-auto">
        {/* Mobile Brand Header */}
        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <img src="/icon.png" alt="Pawnify" className="w-9 h-9 object-contain" />
          <span
            className="font-black text-2xl tracking-tight font-sans"
            style={{ color: "var(--text-primary)" }}
          >
            PAWNIFY
          </span>
        </div>

        {/* Clean Form Card */}
        <div
          className="w-full max-w-md rounded-3xl p-8 sm:p-10 relative transition-all duration-300 shadow-xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
          }}
        >
          {/* Header */}
          <div className="mb-6">
            <h2
              className="text-2xl sm:text-3xl font-extrabold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Sign in to Pawnify
            </h2>
            <p
              className="text-xs sm:text-sm mt-1 font-normal"
              style={{ color: "var(--text-muted)" }}
            >
              Enter your mobile number and password to access the platform
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-red-500 dark:text-red-400 text-xs font-medium animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="input-label flex items-center gap-1.5 font-medium text-xs mb-1.5"
                htmlFor="phone"
                style={{ color: "var(--text-secondary)" }}
              >
                Mobile Number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
                maxLength={14}
                className="input-field w-full px-3.5 py-2.5 rounded-xl text-sm transition-all"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label
                className="input-label flex items-center gap-1.5 font-medium text-xs mb-1.5"
                htmlFor="password"
                style={{ color: "var(--text-secondary)" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="input-field w-full px-3.5 py-2.5 rounded-xl text-sm transition-all"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
                disabled={loading}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm shadow-md transition-all duration-200 hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer mt-4"
              style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials Quick-Fill Section */}
          <div
            className="mt-8 pt-5 animate-fadeIn"
            style={{ borderTop: "1px solid var(--border-primary)" }}
          >
            <div
              className="flex items-center justify-between text-[11px] mb-2.5 font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              <span>Demo Accounts (Click to fill)</span>
              <span className="text-emerald-500 font-mono">Instant Access</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fillDemo("9876543210")}
                className="p-2.5 rounded-xl transition-all text-left flex items-center justify-between group cursor-pointer hover:border-emerald-500/40"
                style={{
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-primary)",
                }}
              >
                <div className="min-w-0">
                  <div
                    className="text-xs font-semibold truncate flex items-center gap-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Admin <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 inline" />
                  </div>
                  <div
                    className="text-[10px] font-mono truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    9876543210
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-(--text-muted) group-hover:text-(--accent) shrink-0 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => fillDemo("9876543211")}
                className="p-2.5 rounded-xl transition-all text-left flex items-center justify-between group cursor-pointer hover:border-emerald-500/40"
                style={{
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-primary)",
                }}
              >
                <div className="min-w-0">
                  <div
                    className="text-xs font-semibold truncate flex items-center gap-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Staff <UserCheck className="w-3.5 h-3.5 text-blue-500 inline" />
                  </div>
                  <div
                    className="text-[10px] font-mono truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    9876543211
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-(--text-muted) group-hover:text-(--accent) shrink-0 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen w-full flex items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
