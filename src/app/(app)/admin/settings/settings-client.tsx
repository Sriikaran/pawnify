"use client";

import React, { useState } from "react";
import {
  useSaveSettingsMutation,
  useFetchLiveSpotRatesMutation,
} from "@/lib/redux/api/settingsApi";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Percent,
  PercentCircle,
  ShieldAlert,
  Calendar,
  Coins,
  RefreshCw,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

interface SettingsFormProps {
  initialSettings: {
    ltv_tier1_max: string;
    ltv_tier2_max: string;
    ltv_tier3_max: string;
    ltv_tier1_limit: string;
    ltv_tier2_limit: string;
    default_interest_monthly: string;
    default_grace_days: string;
    pan_required_threshold: string;
    rate_gold_per_gram: string;
    rate_silver_per_gram: string;
    valuation_safety_margin: string;
    rate_last_updated: string;
  };
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [saveSettings, { isLoading: loading }] = useSaveSettingsMutation();
  const [fetchLiveSpotRates, { isLoading: fetchingSpot }] = useFetchLiveSpotRatesMutation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [spotSuccess, setSpotSuccess] = useState(false);

  const [form, setForm] = useState(initialSettings);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSuccess(false);
    setSpotSuccess(false);
  };

  const handleFetchSpot = async () => {
    setError(null);
    setSpotSuccess(false);

    const res = await fetchLiveSpotRates();

    if ("error" in res) {
      setError(
        (res.error as { message?: string })?.message || "Failed to fetch spot rates from open API"
      );
    } else if (res.data && "rates" in res.data && res.data.rates) {
      const { rates } = res.data;
      setForm((prev) => ({
        ...prev,
        rate_gold_per_gram: rates.goldRatePerGram.toString(),
        rate_silver_per_gram: rates.silverRatePerGram.toString(),
        rate_last_updated: rates.lastUpdated,
      }));
      setSpotSuccess(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSpotSuccess(false);

    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));

    const res = await saveSettings(formData);
    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to save settings");
      return;
    }

    setSuccess(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 w-full max-w-5xl mx-auto">
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-sm flex items-center gap-3 animate-fadeIn"
          style={{ color: "var(--accent-text)" }}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-semibold">
            System settings updated successfully! New LTV slabs, spot rates, and interest rules will
            apply immediately.
          </span>
        </div>
      )}

      {spotSuccess && (
        <div
          className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-sm flex items-center gap-3 animate-fadeIn"
          style={{ color: "var(--text-primary)" }}
        >
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="font-semibold">
            Spot metal rates successfully synchronized from free open financial API! Don&apos;t
            forget to click Save System Settings.
          </span>
        </div>
      )}

      {/* Card 1: Live Metal Spot Rates & Safety Margin */}
      <div className="glass-card p-6 sm:p-8 space-y-6 border-(--accent-border)">
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5" style={{ color: "var(--accent-text)" }} />
            <div>
              <h2
                className="text-base font-bold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <span>Live Metal Spot Rates & Valuation Haircut</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-normal"
                  style={{
                    background: "var(--accent-bg)",
                    color: "var(--accent-text)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  Cron Auto-Synced
                </span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                Baseline spot rate per gram used when appraising 24K Gold and Fine Silver items. Can
                be fetched live or overridden manually.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFetchSpot}
            disabled={fetchingSpot}
            className="btn-secondary text-xs px-4 py-2 inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer shrink-0"
            title="Fetch real-time Indian spot price from open financial API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fetchingSpot ? "animate-spin" : ""}`} />
            <span>{fetchingSpot ? "Fetching Spot API..." : "⚡ Fetch Spot Rate Now"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="input-label" htmlFor="goldRate">
              24K Gold Spot Rate (₹/g) *
            </label>
            <input
              id="goldRate"
              name="rate_gold_per_gram"
              type="number"
              step="any"
              min="1000"
              value={form.rate_gold_per_gram}
              onChange={handleChange}
              className="input-field font-mono text-base font-bold py-3"
              style={{ color: "var(--accent-text)" }}
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              Standard 24K Pure Gold Spot
            </span>
          </div>

          <div>
            <label className="input-label" htmlFor="silverRate">
              Fine Silver Spot Rate (₹/g) *
            </label>
            <input
              id="silverRate"
              name="rate_silver_per_gram"
              type="number"
              step="any"
              min="10"
              value={form.rate_silver_per_gram}
              onChange={handleChange}
              className="input-field font-mono text-base font-bold py-3"
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              Standard 999 Fine Silver Spot
            </span>
          </div>

          <div>
            <label className="input-label flex items-center gap-1" htmlFor="margin">
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />
              Valuation Haircut / Margin (%) *
            </label>
            <input
              id="margin"
              name="valuation_safety_margin"
              type="number"
              step="any"
              min="0"
              max="20"
              value={form.valuation_safety_margin}
              onChange={handleChange}
              className="input-field font-mono text-base font-bold py-3"
              style={{ color: "var(--accent-text)" }}
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              Safety discount against market volatility
            </span>
          </div>
        </div>

        <div
          className="text-[11px] font-mono p-3 rounded-lg flex items-center justify-between"
          style={{
            color: "var(--text-muted)",
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          <span>
            Last Synchronized:{" "}
            <strong style={{ color: "var(--text-primary)" }}>{form.rate_last_updated}</strong>
          </span>
          <span style={{ color: "var(--accent-text)" }}>Background Cron Active (15m interval)</span>
        </div>
      </div>

      {/* Card 2: RBI LTV Slabs Card */}
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div
          className="flex items-center gap-2 pb-4"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <PercentCircle className="w-5 h-5" style={{ color: "var(--accent-text)" }} />
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              RBI-Compliant Tiered LTV Slabs (§6.2)
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              Maximum allowable Loan-to-Value percentage and valuation thresholds for gold and
              silver collateral.
            </p>
          </div>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-2"
          style={{ borderBottom: "1px solid var(--border-secondary)" }}
        >
          <div>
            <label className="input-label" htmlFor="tier1Limit">
              Tier 1 Maximum Assessed Value (₹) *
            </label>
            <input
              id="tier1Limit"
              name="ltv_tier1_limit"
              type="number"
              step="any"
              min="10000"
              value={form.ltv_tier1_limit}
              onChange={handleChange}
              className="input-field font-mono text-sm py-2.5 font-bold"
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              Default: ₹2,50,000 threshold
            </span>
          </div>

          <div>
            <label className="input-label" htmlFor="tier2Limit">
              Tier 2 Maximum Assessed Value (₹) *
            </label>
            <input
              id="tier2Limit"
              name="ltv_tier2_limit"
              type="number"
              step="any"
              min="100000"
              value={form.ltv_tier2_limit}
              onChange={handleChange}
              className="input-field font-mono text-sm py-2.5 font-bold"
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              Default: ₹5,00,000 threshold
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="input-label" htmlFor="tier1">
              Tier 1 LTV Cap (%) *
            </label>
            <input
              id="tier1"
              name="ltv_tier1_max"
              type="number"
              step="any"
              min="50"
              max="90"
              value={form.ltv_tier1_max}
              onChange={handleChange}
              className="input-field font-mono text-base font-bold py-3"
              style={{ color: "var(--accent-text)" }}
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              For values ≤ Tier 1 limit (Default: 85%)
            </span>
          </div>

          <div>
            <label className="input-label" htmlFor="tier2">
              Tier 2 LTV Cap (%) *
            </label>
            <input
              id="tier2"
              name="ltv_tier2_max"
              type="number"
              step="any"
              min="50"
              max="90"
              value={form.ltv_tier2_max}
              onChange={handleChange}
              className="input-field font-mono text-base font-bold py-3"
              style={{ color: "var(--accent-text)" }}
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              For values between Tier 1 & 2 (Default: 80%)
            </span>
          </div>

          <div>
            <label className="input-label" htmlFor="tier3">
              Tier 3 LTV Cap (%) *
            </label>
            <input
              id="tier3"
              name="ltv_tier3_max"
              type="number"
              step="any"
              min="50"
              max="90"
              value={form.ltv_tier3_max}
              onChange={handleChange}
              className="input-field font-mono text-base font-bold py-3"
              style={{ color: "var(--accent-text)" }}
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              For values &gt; Tier 2 limit (Default: 75%)
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: Defaults & KYC Thresholds */}
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div
          className="flex items-center gap-2 pb-4"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <ShieldAlert className="w-5 h-5" style={{ color: "var(--accent-text)" }} />
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Interest, Grace & Regulatory KYC Rules
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              Default terms applied to new loan agreements and compliance triggers for PAN mandatory
              verification.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="input-label flex items-center gap-1" htmlFor="interest">
              <Percent className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              Default Monthly Simple Interest (%) *
            </label>
            <input
              id="interest"
              name="default_interest_monthly"
              type="number"
              step="any"
              min="0.5"
              max="5.0"
              value={form.default_interest_monthly}
              onChange={handleChange}
              className="input-field font-mono text-sm py-2.5"
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              Default: 1.5% simple interest per month
            </span>
          </div>

          <div>
            <label className="input-label flex items-center gap-1" htmlFor="grace">
              <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              Default Grace Period (Days) *
            </label>
            <input
              id="grace"
              name="default_grace_days"
              type="number"
              step="any"
              min="0"
              max="30"
              value={form.default_grace_days}
              onChange={handleChange}
              className="input-field font-mono text-sm py-2.5"
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              Default: 7 days without penal interest
            </span>
          </div>

          <div>
            <label className="input-label" htmlFor="pan">
              PAN Mandatory Threshold (₹) *
            </label>
            <input
              id="pan"
              name="pan_required_threshold"
              type="number"
              step="any"
              min="10000"
              value={form.pan_required_threshold}
              onChange={handleChange}
              className="input-field font-mono text-sm py-2.5 font-bold"
              required
            />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--text-muted)" }}>
              Default: ₹50,000 active exposure
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-8 py-3.5 text-sm font-bold shadow-xl shadow-amber-500/20 cursor-pointer inline-flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving Settings...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save System Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}
