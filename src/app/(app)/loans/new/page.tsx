"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DocumentUploader } from "@/components/document-uploader";
import { useCreateLoanMutation } from "@/lib/redux/api/loansApi";
import {
  Coins,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  User,
  Scale,
  Calculator,
  ShieldCheck,
  Calendar,
  Percent,
} from "lucide-react";

interface CustomerSearchResult {
  id: string;
  fullName: string;
  phone: string;
  city: string;
}

interface LoanItemForm {
  metalType: "GOLD" | "SILVER";
  description: string;
  purityLabel: string;
  purityPercent: number;
  grossWeightGrams: number;
  stoneWeightGrams: number;
  valuationRatePerGram: number;
  packetNumber: string;
  storageLocation: string;
  photoUrl?: string;
}

function NewLoanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId") || "";

  const [createLoan, { isLoading: loading }] = useCreateLoanMutation();
  const [error, setError] = useState<string | null>(null);

  // Customer Search State
  const [customerQuery, setCustomerQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Initial Customer Fetch if URL param exists
  useEffect(() => {
    if (initialCustomerId && !selectedCustomer) {
      fetch(`/api/customers/search?q=${initialCustomerId}`)
        .then((res) => res.json())
        .then((data: CustomerSearchResult[]) => {
          if (data && data.length > 0) {
            setSelectedCustomer(data[0]);
          }
        })
        .catch(console.error);
    }
  }, [initialCustomerId, selectedCustomer]);

  // Customer Typeahead
  useEffect(() => {
    if (customerQuery.length < 2) {
      const t = setTimeout(() => setSearchResults([]), 0);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/customers/search?q=${encodeURIComponent(customerQuery)}`)
        .then((res) => res.json())
        .then((data) => {
          setSearchResults(Array.isArray(data) ? data : []);
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  // Live Spot Rates & Valuation Haircut State
  const [spotRates, setSpotRates] = useState<{
    gold: number;
    silver: number;
    margin: number;
    ltvTier1Percent: number;
    ltvTier2Percent: number;
    ltvTier3Percent: number;
    ltvTier1Max: number;
    ltvTier2Max: number;
  }>({
    gold: 7850,
    silver: 98.5,
    margin: 0,
    ltvTier1Percent: 85,
    ltvTier2Percent: 80,
    ltvTier3Percent: 75,
    ltvTier1Max: 250000,
    ltvTier2Max: 500000,
  });

  // Collateral Items State
  const [items, setItems] = useState<LoanItemForm[]>(() => [
    {
      metalType: "GOLD",
      description: "22K Gold Chain",
      purityLabel: "22K",
      purityPercent: 91.6,
      grossWeightGrams: 20,
      stoneWeightGrams: 0,
      valuationRatePerGram: 7850,
      packetNumber: `PKT-${Date.now().toString().slice(-4)}`,
      storageLocation: "Vault A / Rack 1 / Shelf 1",
    },
  ]);

  // Loan Terms State
  const [tenureMonths, setTenureMonths] = useState(6);
  const [interestRateMonthly, setInterestRateMonthly] = useState(1.5);
  const [principalAmount, setPrincipalAmount] = useState(100000);
  const [processingFee, setProcessingFee] = useState(500);
  const [gracePeriodDays, setGracePeriodDays] = useState(7);

  useEffect(() => {
    // Fetch cached market spot rates and apply valuation safety margin & formulas
    fetch("/api/market-rates")
      .then((res) => res.json())
      .then((data) => {
        if (data?.rates) {
          const gold = data.rates.goldRatePerGram;
          const silver = data.rates.silverRatePerGram;
          const margin = data.rates.safetyMarginPercent || 0;
          const effGold = Number((gold * (1 - margin / 100)).toFixed(2));
          const effSilver = Number((silver * (1 - margin / 100)).toFixed(2));

          setSpotRates({
            gold: effGold,
            silver: effSilver,
            margin,
            ltvTier1Percent: data.rates.ltvTier1Percent || 85,
            ltvTier2Percent: data.rates.ltvTier2Percent || 80,
            ltvTier3Percent: data.rates.ltvTier3Percent || 75,
            ltvTier1Max: data.rates.ltvTier1Max || 250000,
            ltvTier2Max: data.rates.ltvTier2Max || 500000,
          });

          if (data.rates.defaultInterestMonthly) {
            setInterestRateMonthly(data.rates.defaultInterestMonthly);
          }
          if (data.rates.defaultGraceDays) {
            setGracePeriodDays(data.rates.defaultGraceDays);
          }

          setItems((prev) =>
            prev.map((it) => ({
              ...it,
              valuationRatePerGram: it.metalType === "GOLD" ? effGold : effSilver,
            }))
          );
        }
      })
      .catch((err) => console.error("Failed to fetch spot rates for new loan:", err));
  }, []);

  // Purity presets helper
  const handlePurityChange = (index: number, label: string) => {
    const updated = [...items];
    updated[index].purityLabel = label;
    if (label === "24K") updated[index].purityPercent = 99.9;
    else if (label === "22K") updated[index].purityPercent = 91.6;
    else if (label === "18K") updated[index].purityPercent = 75.0;
    else if (label === "14K") updated[index].purityPercent = 58.5;
    else if (label === "Fine Silver") updated[index].purityPercent = 99.9;
    else if (label === "Sterling Silver") updated[index].purityPercent = 92.5;
    setItems(updated);
  };

  const handleItemChange = (index: number, field: keyof LoanItemForm, val: string | number) => {
    const updated = [...items];
    if (field === "metalType") {
      const metal = val as "GOLD" | "SILVER";
      updated[index].metalType = metal;
      if (metal === "GOLD") {
        updated[index].purityLabel = "22K";
        updated[index].purityPercent = 91.6;
        updated[index].valuationRatePerGram = spotRates.gold;
      } else {
        updated[index].purityLabel = "Sterling Silver";
        updated[index].purityPercent = 92.5;
        updated[index].valuationRatePerGram = spotRates.silver;
      }
    } else {
      // @ts-expect-error dynamic field update
      updated[index][field] = val;
    }
    setItems(updated);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        metalType: "GOLD",
        description: "22K Gold Bangle",
        purityLabel: "22K",
        purityPercent: 91.6,
        grossWeightGrams: 15,
        stoneWeightGrams: 0,
        valuationRatePerGram: spotRates.gold,
        packetNumber: `PKT-${Math.floor(1000 + Math.random() * 9000)}`,
        storageLocation: "Vault A / Rack 1 / Shelf 2",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Live Valuation & LTV Slabs Calculation (§6.1 / §6.2)
  const computeTotals = () => {
    let totalAssessed = 0;
    for (const item of items) {
      const netWeight = Math.max(0, item.grossWeightGrams - item.stoneWeightGrams);
      const fineWeight = (netWeight * item.purityPercent) / 100;
      const assessed = fineWeight * item.valuationRatePerGram;
      totalAssessed += assessed;
    }

    let ltvPercent = spotRates.ltvTier1Percent || 85;
    if (totalAssessed > (spotRates.ltvTier2Max || 500000)) {
      ltvPercent = spotRates.ltvTier3Percent || 75;
    } else if (totalAssessed > (spotRates.ltvTier1Max || 250000)) {
      ltvPercent = spotRates.ltvTier2Percent || 80;
    }

    const eligibleAmount = Math.floor((totalAssessed * ltvPercent) / 100);
    return { totalAssessed, ltvPercent, eligibleAmount };
  };

  const { totalAssessed, ltvPercent, eligibleAmount } = computeTotals();

  // Auto-set principal to eligible amount when items change if principal exceeds eligible
  useEffect(() => {
    if (principalAmount > eligibleAmount && eligibleAmount > 0) {
      const t = setTimeout(() => setPrincipalAmount(eligibleAmount), 0);
      return () => clearTimeout(t);
    }
  }, [eligibleAmount, principalAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setError("Please select a registered customer profile");
      return;
    }
    if (principalAmount > eligibleAmount) {
      setError(
        `Principal cannot exceed eligible amount (₹${eligibleAmount.toLocaleString("en-IN")})`
      );
      return;
    }

    setError(null);

    const res = await createLoan({
      customerId: selectedCustomer.id,
      items,
      tenureMonths: Number(tenureMonths),
      interestRateMonthly: Number(interestRateMonthly),
      principalAmount: Number(principalAmount),
      processingFee: Number(processingFee),
      gracePeriodDays: Number(gracePeriodDays),
    });

    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to disburse loan");
      return;
    }

    router.push(`/loans/${res.data.loanId}`);
  };

  const formatINR = (num: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-4">
        <Link
          href="/loans"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-(--text-secondary) hover:text-(--accent) transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Loans Directory
        </Link>
      </div>

      <PageHeader
        title="Disburse New Loan Contract"
        description="Select customer, record pledged gold/silver items, check RBI-compliant LTV slabs, and issue disbursal."
      />

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Customer Selection */}
        <div className="glass-card p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-(--border-primary)">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-(--accent)" />
              <h2 className="text-base font-semibold text-(--text-primary)">
                Step 1: Customer Selection
              </h2>
            </div>
            <Link
              href="/customers/new"
              className="text-xs font-medium text-(--accent) hover:underline"
            >
              + Register New Customer
            </Link>
          </div>

          {selectedCustomer ? (
            <div className="p-4 rounded-xl bg-(--accent-bg) border border-(--accent-border) flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-(--accent-bg) text-(--accent) flex items-center justify-center font-bold text-base shrink-0">
                  {selectedCustomer.fullName.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-sm text-(--text-primary)">
                    {selectedCustomer.fullName}
                  </div>
                  <div className="text-xs text-(--text-secondary) font-mono">
                    {selectedCustomer.phone} • {selectedCustomer.city}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="w-4 h-4 text-(--text-muted) absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Type customer name or phone number to search..."
                  className="input-field pl-10 text-sm py-3"
                />
              </div>

              {searching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-(--text-muted)">
                  Searching...
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 p-2 rounded-xl bg-(--bg-card) border border-(--border-card) shadow-2xl z-20 max-h-60 overflow-y-auto space-y-1">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerQuery("");
                        setSearchResults([]);
                      }}
                      className="w-full p-2.5 rounded-lg hover:bg-(--bg-tertiary) text-left flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-xs text-(--text-primary)">
                          {c.fullName}
                        </div>
                        <div className="text-[11px] text-(--text-muted) font-mono">
                          {c.phone} • {c.city}
                        </div>
                      </div>
                      <span className="text-[10px] text-(--accent) font-semibold px-2 py-0.5 rounded bg-(--accent-bg)">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Collateral Items Builder */}
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-(--border-primary)">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-(--accent)" />
              <h2 className="text-base font-semibold text-(--text-primary)">
                Step 2: Pledged Collateral Items ({items.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5 text-(--accent) border-(--accent-border)"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another Item
            </button>
          </div>

          <div className="space-y-6">
            {items.map((item, idx) => {
              const netWeight = Math.max(0, item.grossWeightGrams - item.stoneWeightGrams);
              const fineWeight = (netWeight * item.purityPercent) / 100;
              const assessed = fineWeight * item.valuationRatePerGram;

              return (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-(--bg-tertiary) border border-(--border-primary) space-y-4 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-(--accent-bg) text-(--accent) font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">
                        Item #{idx + 1} • Valued at{" "}
                        <span className="text-(--accent) font-bold">{formatINR(assessed)}</span>
                      </span>
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1.5 rounded-lg text-(--text-muted) hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="input-label">Metal Type</label>
                      <select
                        value={item.metalType}
                        onChange={(e) => handleItemChange(idx, "metalType", e.target.value)}
                        className="input-field text-xs py-2"
                      >
                        <option value="GOLD">Gold</option>
                        <option value="SILVER">Silver</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="input-label">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        placeholder="e.g. 22K Gold Necklace"
                        className="input-field text-xs py-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="input-label">Purity Label</label>
                      <select
                        value={item.purityLabel}
                        onChange={(e) => handlePurityChange(idx, e.target.value)}
                        className="input-field text-xs py-2"
                      >
                        {item.metalType === "GOLD" ? (
                          <>
                            <option value="24K">24K (99.9%)</option>
                            <option value="22K">22K (91.6%)</option>
                            <option value="18K">18K (75.0%)</option>
                            <option value="14K">14K (58.5%)</option>
                          </>
                        ) : (
                          <>
                            <option value="Fine Silver">Fine Silver (99.9%)</option>
                            <option value="Sterling Silver">Sterling Silver (92.5%)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="input-label">Gross Weight (g) *</label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={item.grossWeightGrams}
                        onChange={(e) =>
                          handleItemChange(idx, "grossWeightGrams", Number(e.target.value))
                        }
                        className="input-field font-mono text-xs py-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="input-label">Stone/Wax Weight (g)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.stoneWeightGrams}
                        onChange={(e) =>
                          handleItemChange(idx, "stoneWeightGrams", Number(e.target.value))
                        }
                        className="input-field font-mono text-xs py-2"
                      />
                    </div>

                    <div>
                      <label className="input-label">Rate per Gram (₹) *</label>
                      <input
                        type="number"
                        step="any"
                        min="1"
                        value={item.valuationRatePerGram}
                        onChange={(e) =>
                          handleItemChange(idx, "valuationRatePerGram", Number(e.target.value))
                        }
                        className="input-field font-mono text-xs py-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="input-label">Net & Fine Weight</label>
                      <div className="p-2 rounded-lg bg-(--bg-secondary) border border-(--border-primary) text-[11px] font-mono text-(--text-secondary) flex items-center justify-between">
                        <span>
                          Net: <b className="text-(--text-primary)">{netWeight.toFixed(2)}g</b>
                        </span>
                        <span>
                          Fine: <b className="text-(--accent)">{fineWeight.toFixed(2)}g</b>
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="input-label">Packet No. (Secure Tag) *</label>
                      <input
                        type="text"
                        value={item.packetNumber}
                        onChange={(e) => handleItemChange(idx, "packetNumber", e.target.value)}
                        placeholder="PKT-001"
                        className="input-field font-mono text-xs py-2"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="input-label">Storage Location in Vault *</label>
                      <input
                        type="text"
                        value={item.storageLocation}
                        onChange={(e) => handleItemChange(idx, "storageLocation", e.target.value)}
                        placeholder="Vault A / Rack 1 / Shelf 2"
                        className="input-field text-xs py-2"
                        required
                      />
                    </div>

                    <div className="sm:col-span-4 pt-3 border-t border-(--border-primary)">
                      <DocumentUploader
                        label={`Upload ${item.metalType === "GOLD" ? "Gold" : "Silver"} Item Photo (${item.description || "Item #" + (idx + 1)})`}
                        bucket="pawnify-collateral"
                        accept=".png,.jpg,.jpeg,.webp"
                        initialDocs={
                          item.photoUrl
                            ? [
                                {
                                  name: `${item.packetNumber || "item"}_photo`,
                                  url: item.photoUrl,
                                  uploadedAt: "Current",
                                },
                              ]
                            : []
                        }
                        onUploadComplete={(doc) => handleItemChange(idx, "photoUrl", doc.url)}
                        onRemove={() => handleItemChange(idx, "photoUrl", "")}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: LTV Eligibility & Loan Terms */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Loan Terms */}
          <div className="lg:col-span-2 glass-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-(--border-primary)">
              <Coins className="w-5 h-5 text-(--accent)" />
              <h2 className="text-base font-semibold text-(--text-primary)">
                Step 3: Loan Terms & Disbursal
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="input-label mb-0" htmlFor="principalAmount">
                    Principal Disbursal Amount (₹) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setPrincipalAmount(eligibleAmount)}
                    className="text-xs font-semibold text-(--accent) hover:underline cursor-pointer"
                  >
                    Set Max Eligible (₹{eligibleAmount.toLocaleString("en-IN")})
                  </button>
                </div>
                <input
                  id="principalAmount"
                  type="number"
                  step="any"
                  min="0.01"
                  max={eligibleAmount}
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                  className="input-field font-mono text-lg font-bold text-(--accent) py-3"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[0.25, 0.5, 0.75, 1].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPrincipalAmount(Number((eligibleAmount * pct).toFixed(2)))}
                      className="text-[10px] px-2 py-0.5 rounded bg-(--bg-tertiary) border border-(--border-primary) text-(--text-secondary) hover:text-(--accent) hover:border-(--accent-border) transition-all cursor-pointer font-mono"
                    >
                      {pct * 100}% (₹{(eligibleAmount * pct).toFixed(0)})
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-(--text-muted) mt-1 block">
                  Cannot exceed eligible amount based on {ltvPercent}% RBI LTV slab.
                </span>
              </div>

              <div>
                <label className="input-label flex items-center gap-1" htmlFor="tenureMonths">
                  <Calendar className="w-3.5 h-3.5 text-(--text-secondary)" />
                  Tenure (Months) *
                </label>
                <select
                  id="tenureMonths"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  className="input-field text-sm py-2.5"
                >
                  <option value={1}>1 Month</option>
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months (Recommended)</option>
                  <option value={9}>9 Months</option>
                  <option value={12}>12 Months (Max RBI Cap)</option>
                </select>
              </div>

              <div>
                <label className="input-label flex items-center gap-1" htmlFor="interestRate">
                  <Percent className="w-3.5 h-3.5 text-(--text-secondary)" />
                  Monthly Interest Rate (%) *
                </label>
                <input
                  id="interestRate"
                  type="number"
                  step="any"
                  min="0.01"
                  max="10"
                  value={interestRateMonthly}
                  onChange={(e) => setInterestRateMonthly(Number(e.target.value))}
                  className="input-field font-mono text-sm py-2.5"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[1.0, 1.5, 2.0, 2.5, 3.0].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setInterestRateMonthly(rate)}
                      className="text-[10px] px-2 py-0.5 rounded bg-(--bg-tertiary) border border-(--border-primary) text-(--text-secondary) hover:text-(--accent) hover:border-(--accent-border) transition-all cursor-pointer font-mono"
                    >
                      {rate}% pm
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-(--text-muted) mt-0.5 block">
                  Simple interest, Actual/365 convention
                </span>
              </div>

              <div>
                <label className="input-label" htmlFor="fee">
                  Processing Fee (₹)
                </label>
                <input
                  id="fee"
                  type="number"
                  step="any"
                  min="0"
                  value={processingFee}
                  onChange={(e) => setProcessingFee(Number(e.target.value))}
                  className="input-field font-mono text-sm py-2.5"
                />
              </div>

              <div>
                <label className="input-label" htmlFor="grace">
                  Grace Period (Days)
                </label>
                <input
                  id="grace"
                  type="number"
                  step="any"
                  min="0"
                  max="30"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(Number(e.target.value))}
                  className="input-field font-mono text-sm py-2.5"
                />
              </div>
            </div>
          </div>

          {/* Right 1 Col: Live LTV & Summary Card */}
          <div className="space-y-6">
            <div className="kpi-card border-(--accent-border) shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-(--border-primary)">
                <span className="text-xs font-bold uppercase tracking-wider text-(--accent) flex items-center gap-1.5">
                  <Calculator className="w-4 h-4" />
                  RBI LTV Valuation Slab
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-(--text-secondary) text-xs">Total Assessed Value</span>
                  <span className="font-bold text-(--text-primary)">
                    {formatINR(totalAssessed)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-(--text-secondary) text-xs">Applicable LTV Slab</span>
                  <span className="font-bold text-(--accent) px-2 py-0.5 rounded bg-(--accent-bg) text-xs">
                    {ltvPercent}%
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-(--border-primary)">
                  <span className="text-(--text-secondary) font-semibold text-xs">
                    Max Eligible Loan
                  </span>
                  <span className="font-bold text-base text-(--accent)">
                    {formatINR(eligibleAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-(--text-secondary) font-semibold text-xs">
                    Requested Disbursal
                  </span>
                  <span className="font-bold text-base text-(--accent)">
                    {formatINR(principalAmount)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-(--bg-secondary) border border-(--border-primary) text-[11px] text-(--text-secondary) space-y-1">
                <div className="font-semibold text-(--text-secondary) flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-(--accent)" />
                  Tiered LTV Rules Applied (§6.2)
                </div>
                <div>• ≤ ₹2,50,000 : 85% LTV Cap</div>
                <div>• ₹2,50,001 - ₹5,00,000 : 80% LTV Cap</div>
                <div>• &gt; ₹5,00,000 : 75% LTV Cap</div>
              </div>
            </div>

            <div className="pt-2">
              <DocumentUploader
                label="Upload Collateral Photos & Signed Pawn Agreement"
                bucket="pawnify-collateral"
              />
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !selectedCustomer ||
                principalAmount > eligibleAmount ||
                principalAmount <= 0
              }
              className="btn-primary w-full py-4 text-base font-bold shadow-xl cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Disbursing Loan...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Confirm & Disburse Loan
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewLoanPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-(--text-muted)">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-(--accent)" />
        </div>
      }
    >
      <NewLoanForm />
    </Suspense>
  );
}
