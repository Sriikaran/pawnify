"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ItemPhotosUploader } from "@/components/item-photos-uploader";
import { createLoanAction } from "./actions";
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
  Calendar,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface CustomerSearchResult {
  id: string;
  fullName: string;
  phone: string;
  city: string;
}

interface MetalOption {
  id: string;
  metalKey: string;
  displayName: string;
}

interface PurityOption {
  id: string;
  label: string;
  purityPercent: number;
  finenessCode?: string | null;
}

interface LoanItemForm {
  metalType: string;
  description: string;
  purityLabel: string;
  purityPercent: number;
  grossWeightGrams: number | "";
  stoneWeightGrams: number | "";
  valuationRatePerGram: number | "";
  packetNumber: string;
  storageLocation: string;
  photoUrls: string[];
}

function NewLoanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ==================== Step 1: Customer State ====================
  const [customerQuery, setCustomerQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Fetch initial customer if provided in URL
  useEffect(() => {
    if (initialCustomerId && !selectedCustomer) {
      fetch(`/api/customers/search?q=${initialCustomerId}`)
        .then((res) => res.json())
        .then((data: CustomerSearchResult[]) => {
          if (data && data.length > 0) setSelectedCustomer(data[0]);
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

  // ==================== Master Data: Metals & Purities ====================
  const [metals, setMetals] = useState<MetalOption[]>([
    { id: "gold-default", metalKey: "GOLD", displayName: "Gold" },
    { id: "silver-default", metalKey: "SILVER", displayName: "Silver" },
  ]);
  const [puritiesByMetal, setPuritiesByMetal] = useState<Record<string, PurityOption[]>>({});

  // Add New Metal Modal State
  const [newMetalModalOpen, setNewMetalModalOpen] = useState(false);
  const [newMetalName, setNewMetalName] = useState("");
  const [addingMetal, setAddingMetal] = useState(false);
  const [activeItemIndexForMetal, setActiveItemIndexForMetal] = useState<number | null>(null);

  // Add New Purity Modal State
  const [newPurityModalOpen, setNewPurityModalOpen] = useState(false);
  const [newPurityLabel, setNewPurityLabel] = useState("");
  const [newPurityPercent, setNewPurityPercent] = useState<number | "">("");
  const [newPurityFineness, setNewPurityFineness] = useState("");
  const [addingPurity, setAddingPurity] = useState(false);
  const [activeItemIndexForPurity, setActiveItemIndexForPurity] = useState<number | null>(null);

  // Spot Rates Cache
  const [spotRates, setSpotRates] = useState<{
    gold: number;
    silver: number;
    ltvTier1Percent: number;
    ltvTier2Percent: number;
    ltvTier3Percent: number;
    ltvTier1Max: number;
    ltvTier2Max: number;
  }>({
    gold: 7850,
    silver: 98.5,
    ltvTier1Percent: 85,
    ltvTier2Percent: 80,
    ltvTier3Percent: 75,
    ltvTier1Max: 250000,
    ltvTier2Max: 500000,
  });

  // Fetch metals and spot rates on mount
  useEffect(() => {
    fetch("/api/master-data/metals")
      .then((res) => res.json())
      .then((data) => {
        if (data?.metals && data.metals.length > 0) setMetals(data.metals);
      })
      .catch(console.error);

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
            ltvTier1Percent: data.rates.ltvTier1Percent || 85,
            ltvTier2Percent: data.rates.ltvTier2Percent || 80,
            ltvTier3Percent: data.rates.ltvTier3Percent || 75,
            ltvTier1Max: data.rates.ltvTier1Max || 250000,
            ltvTier2Max: data.rates.ltvTier2Max || 500000,
          });
        }
      })
      .catch(console.error);
  }, []);

  // Helper to load purities for a metal
  const loadPuritiesForMetal = async (metalKey: string) => {
    if (puritiesByMetal[metalKey]) return puritiesByMetal[metalKey];
    try {
      const res = await fetch(`/api/master-data/purities?metalKey=${metalKey}`);
      const data = await res.json();
      if (data?.purities) {
        setPuritiesByMetal((prev) => ({ ...prev, [metalKey]: data.purities }));
        return data.purities as PurityOption[];
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  };

  // ==================== Step 2: Collateral Items State ====================
  // Clean initial state with NO pre-filled values
  const createEmptyItem = (metalKey = "GOLD"): LoanItemForm => ({
    metalType: metalKey,
    description: "",
    purityLabel: metalKey === "GOLD" ? "22K" : "Sterling Silver",
    purityPercent: metalKey === "GOLD" ? 91.6 : 92.5,
    grossWeightGrams: "",
    stoneWeightGrams: "",
    valuationRatePerGram: metalKey === "GOLD" ? spotRates.gold : spotRates.silver,
    packetNumber: "",
    storageLocation: "",
    photoUrls: [],
  });

  const [items, setItems] = useState<LoanItemForm[]>([createEmptyItem()]);

  // Load initial purities
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/master-data/purities?metalKey=GOLD").then((r) => r.json()),
      fetch("/api/master-data/purities?metalKey=SILVER").then((r) => r.json()),
    ])
      .then(([goldData, silverData]) => {
        if (active) {
          setPuritiesByMetal((prev) => ({
            ...prev,
            ...(goldData?.purities ? { GOLD: goldData.purities } : {}),
            ...(silverData?.purities ? { SILVER: silverData.purities } : {}),
          }));
        }
      })
      .catch(console.error);

    return () => {
      active = false;
    };
  }, []);

  const handleItemChange = (index: number, field: keyof LoanItemForm, val: unknown) => {
    const updated = [...items];
    // @ts-expect-error dynamic assignment
    updated[index][field] = val;
    setItems(updated);
  };

  const handleMetalSelect = async (index: number, metalVal: string) => {
    if (metalVal === "__ADD_NEW_METAL__") {
      setActiveItemIndexForMetal(index);
      setNewMetalName("");
      setNewMetalModalOpen(true);
      return;
    }

    const purities = await loadPuritiesForMetal(metalVal);
    const defaultPurity = purities[0] || { label: "Standard", purityPercent: 91.6 };

    const updated = [...items];
    updated[index].metalType = metalVal;
    updated[index].purityLabel = defaultPurity.label;
    updated[index].purityPercent = defaultPurity.purityPercent;
    updated[index].valuationRatePerGram =
      metalVal === "GOLD" ? spotRates.gold : metalVal === "SILVER" ? spotRates.silver : 0;
    setItems(updated);
  };

  const handlePuritySelect = (index: number, purityVal: string) => {
    if (purityVal === "__ADD_NEW_PURITY__") {
      setActiveItemIndexForPurity(index);
      setNewPurityLabel("");
      setNewPurityPercent("");
      setNewPurityFineness("");
      setNewPurityModalOpen(true);
      return;
    }

    const metalKey = items[index].metalType;
    const currentPurities = puritiesByMetal[metalKey] || [];
    const found = currentPurities.find((p) => p.label === purityVal);

    const updated = [...items];
    updated[index].purityLabel = purityVal;
    if (found) {
      updated[index].purityPercent = found.purityPercent;
    }
    setItems(updated);
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Add New Metal Handler
  const handleCreateMetal = async () => {
    if (!newMetalName.trim()) return;
    setAddingMetal(true);
    try {
      const res = await fetch("/api/master-data/metals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: newMetalName.trim() }),
      });
      const data = await res.json();
      if (data.success && data.metal) {
        setMetals((prev) => [...prev, data.metal]);
        if (activeItemIndexForMetal !== null) {
          await handleMetalSelect(activeItemIndexForMetal, data.metal.metalKey);
        }
        setNewMetalModalOpen(false);
      } else {
        alert(data.error || "Failed to create metal");
      }
    } catch (e) {
      alert("Error adding new metal");
    } finally {
      setAddingMetal(false);
    }
  };

  // Add New Purity Handler
  const handleCreatePurity = async () => {
    if (!newPurityLabel.trim() || newPurityPercent === "") return;
    setAddingPurity(true);
    try {
      const metalKey =
        activeItemIndexForPurity !== null ? items[activeItemIndexForPurity].metalType : "GOLD";
      const res = await fetch("/api/master-data/purities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metalKey,
          label: newPurityLabel.trim(),
          purityPercent: Number(newPurityPercent),
          finenessCode: newPurityFineness.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.purity) {
        setPuritiesByMetal((prev) => ({
          ...prev,
          [metalKey]: [...(prev[metalKey] || []), data.purity],
        }));
        if (activeItemIndexForPurity !== null) {
          const updated = [...items];
          updated[activeItemIndexForPurity].purityLabel = data.purity.label;
          updated[activeItemIndexForPurity].purityPercent = data.purity.purityPercent;
          setItems(updated);
        }
        setNewPurityModalOpen(false);
      } else {
        alert(data.error || "Failed to create purity");
      }
    } catch (e) {
      alert("Error adding new purity");
    } finally {
      setAddingPurity(false);
    }
  };

  // ==================== Step 3: Loan Terms State ====================
  // Clean initial state with NO fake placeholders
  const [tenureMonths, setTenureMonths] = useState<number | "">("");
  const [interestType, setInterestType] = useState<"STANDARD" | "CUMULATIVE">("STANDARD");
  const [rateFormat, setRateFormat] = useState<"PERCENT" | "PER_100">("PERCENT");
  const [interestInputRate, setInterestInputRate] = useState<number | "">("");
  const [interestFrequency, setInterestFrequency] = useState<
    "DAILY" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY" | "CUSTOM"
  >("MONTHLY");
  const [cumulativePeriodMonths, setCumulativePeriodMonths] = useState<number | "">(12);
  const [interestTreatment, setInterestTreatment] = useState<"KEEP_SEPARATE" | "ADD_TO_CAPITAL">(
    "KEEP_SEPARATE"
  );
  const [principalAmount, setPrincipalAmount] = useState<number | "">("");
  const [processingFee, setProcessingFee] = useState<number | "">("");
  const [gracePeriodDays, setGracePeriodDays] = useState<number | "">("");

  // Rate normalization: ₹1 per ₹100 = 1%
  const effectiveMonthlyRate =
    interestInputRate === "" ? 0 : Number(interestInputRate);

  // Compute item totals & live valuation
  const computeTotals = () => {
    let totalAssessed = 0;
    for (const item of items) {
      const gross = Number(item.grossWeightGrams) || 0;
      const stone = Number(item.stoneWeightGrams) || 0;
      const net = Math.max(0, gross - stone);
      const fine = (net * (Number(item.purityPercent) || 0)) / 100;
      const rate = Number(item.valuationRatePerGram) || 0;
      totalAssessed += fine * rate;
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

  // Reset/Clear Handlers for Each Step
  const handleClearStep1 = () => {
    if (
      selectedCustomer ||
      customerQuery ||
      confirm("Are you sure you want to clear Step 1: Customer Selection?")
    ) {
      setSelectedCustomer(null);
      setCustomerQuery("");
      setSearchResults([]);
    }
  };

  const handleClearStep2 = () => {
    if (confirm("Are you sure you want to clear all collateral items in Step 2?")) {
      setItems([createEmptyItem()]);
    }
  };

  const handleClearStep3 = () => {
    if (confirm("Are you sure you want to reset all loan terms in Step 3?")) {
      setPrincipalAmount("");
      setTenureMonths("");
      setInterestInputRate("");
      setInterestType("STANDARD");
      setRateFormat("PERCENT");
      setInterestFrequency("MONTHLY");
      setCumulativePeriodMonths(12);
      setInterestTreatment("KEEP_SEPARATE");
      setProcessingFee("");
      setGracePeriodDays("");
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setError("Please select a registered customer profile");
      return;
    }

    if (principalAmount === "" || Number(principalAmount) <= 0) {
      setError("Please specify a valid principal amount");
      return;
    }

    if (Number(principalAmount) > eligibleAmount) {
      setError(
        `Principal cannot exceed eligible amount (₹${eligibleAmount.toLocaleString("en-IN")})`
      );
      return;
    }

    if (tenureMonths === "" || Number(tenureMonths) <= 0) {
      setError("Please specify loan tenure in months");
      return;
    }

    if (interestInputRate === "" || Number(interestInputRate) <= 0) {
      setError("Please specify a valid interest rate");
      return;
    }

    // Validate collateral items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.description.trim()) {
        setError(`Item #${i + 1} description is required`);
        return;
      }
      if (it.grossWeightGrams === "" || Number(it.grossWeightGrams) <= 0) {
        setError(`Item #${i + 1} gross weight must be greater than 0`);
        return;
      }
      if (Number(it.stoneWeightGrams || 0) >= Number(it.grossWeightGrams)) {
        setError(`Item #${i + 1} stone weight must be strictly less than gross weight`);
        return;
      }
      if (!it.packetNumber.trim()) {
        setError(`Item #${i + 1} packet number is required`);
        return;
      }
      if (!it.storageLocation.trim()) {
        setError(`Item #${i + 1} storage location in vault is required`);
        return;
      }
    }

    setError(null);
    setLoading(true);

    try {
      const sanitizedItems = items.map((it) => ({
        metalType: it.metalType,
        description: it.description.trim(),
        purityLabel: it.purityLabel,
        purityPercent: Number(it.purityPercent),
        grossWeightGrams: Number(it.grossWeightGrams),
        stoneWeightGrams: Number(it.stoneWeightGrams) || 0,
        valuationRatePerGram: Number(it.valuationRatePerGram) || 0,
        packetNumber: it.packetNumber.trim(),
        storageLocation: it.storageLocation.trim(),
        photoUrls: it.photoUrls,
      }));

      const res = await createLoanAction({
        customerId: selectedCustomer.id,
        items: sanitizedItems,
        tenureMonths: Number(tenureMonths),
        interestRateMonthly: effectiveMonthlyRate,
        principalAmount: Number(principalAmount),
        processingFee: processingFee !== "" ? Number(processingFee) : undefined,
        gracePeriodDays: gracePeriodDays !== "" ? Number(gracePeriodDays) : 7,
        interestType,
        interestFrequency,
        cumulativePeriodMonths:
          interestType === "CUMULATIVE" ? Number(cumulativePeriodMonths) || 12 : undefined,
        interestTreatment:
          interestType === "CUMULATIVE" ? interestTreatment : undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to disburse loan");
        setLoading(false);
        return;
      }

      router.push(`/loans/${res.loanId}`);
    } catch (err: unknown) {
      console.error("Loan disbursal error:", err);
      setError(err instanceof Error ? err.message : "Failed to disburse loan");
      setLoading(false);
    }
  };

  const formatINR = (num: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="mb-2">
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
        description="Select customer, record pledged collateral items, verify valuation, and issue loan contract."
      />

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ==================== STEP 1: CUSTOMER SELECTION ==================== */}
        <div className="glass-card p-6 sm:p-8 space-y-4 relative">
          <div className="flex items-center justify-between pb-4 border-b border-(--border-primary)">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-(--accent)" />
              <h2 className="text-base font-semibold text-(--text-primary)">
                Step 1: Customer Selection
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/customers/new"
                className="text-xs font-medium text-(--accent) hover:underline"
              >
                + Register New Customer
              </Link>
              <button
                type="button"
                onClick={handleClearStep1}
                className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 text-(--text-muted) hover:text-red-400 hover:border-red-500/30 transition-colors"
                title="Clear Step 1"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            </div>
          </div>

          {selectedCustomer ? (
            <div className="p-4 rounded-xl bg-(--accent-bg) border border-(--accent-border) flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-(--accent-bg) text-(--accent) flex items-center justify-center font-bold text-base shrink-0 border border-(--accent-border)">
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
                Change Customer
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

        {/* ==================== STEP 2: COLLATERAL ITEMS ==================== */}
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-(--border-primary)">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-(--accent)" />
              <h2 className="text-base font-semibold text-(--text-primary)">
                Step 2: Pledged Collateral Items ({items.length})
              </h2>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={addItem}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-(--accent) border-(--accent-border)"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Another Item
              </button>
              <button
                type="button"
                onClick={handleClearStep2}
                className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 text-(--text-muted) hover:text-red-400 hover:border-red-500/30 transition-colors"
                title="Clear Step 2"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {items.map((item, idx) => {
              const gross = Number(item.grossWeightGrams) || 0;
              const stone = Number(item.stoneWeightGrams) || 0;
              const netWeight = Math.max(0, gross - stone);
              const fineWeight = (netWeight * (Number(item.purityPercent) || 0)) / 100;

              const metalPurities = puritiesByMetal[item.metalType] || [];

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
                      {/* Section 2.1: VALUED AT REMOVED from header */}
                      <span className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">
                        Item #{idx + 1}
                      </span>
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1.5 rounded-lg text-(--text-muted) hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* Metal Type with Add New */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="input-label mb-0">Metal Type</label>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveItemIndexForMetal(idx);
                            setNewMetalName("");
                            setNewMetalModalOpen(true);
                          }}
                          className="text-[10px] text-(--accent) hover:underline flex items-center gap-0.5"
                        >
                          <Plus className="w-2.5 h-2.5" /> Add New
                        </button>
                      </div>
                      <select
                        value={item.metalType}
                        onChange={(e) => handleMetalSelect(idx, e.target.value)}
                        className="input-field text-xs py-2"
                      >
                        {metals.map((m) => (
                          <option key={m.metalKey} value={m.metalKey}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Description */}
                    <div className="sm:col-span-2">
                      <label className="input-label">Description *</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        placeholder="e.g. Traditional Gold Bangles"
                        className="input-field text-xs py-2"
                        required
                      />
                    </div>

                    {/* Purity Label with Add New */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="input-label mb-0">Purity Label</label>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveItemIndexForPurity(idx);
                            setNewPurityLabel("");
                            setNewPurityPercent("");
                            setNewPurityFineness("");
                            setNewPurityModalOpen(true);
                          }}
                          className="text-[10px] text-(--accent) hover:underline flex items-center gap-0.5"
                        >
                          <Plus className="w-2.5 h-2.5" /> Add New
                        </button>
                      </div>
                      <select
                        value={item.purityLabel}
                        onChange={(e) => handlePuritySelect(idx, e.target.value)}
                        className="input-field text-xs py-2"
                      >
                        {metalPurities.length > 0 ? (
                          metalPurities.map((p) => (
                            <option key={p.label} value={p.label}>
                              {p.label} ({p.purityPercent}%)
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="24K">24K (99.9%)</option>
                            <option value="22K">22K (91.6%)</option>
                            <option value="18K">18K (75.0%)</option>
                            <option value="Fine Silver">Fine Silver (99.9%)</option>
                            <option value="Sterling Silver">Sterling Silver (92.5%)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Section 2.2: Reordered Fields:
                        1. Gross Weight
                        2. Net & Fine Weight
                        3. Stone/Wax Weight
                        4. Rate per Gram
                    */}
                    <div>
                      <label className="input-label">Gross Weight (g) *</label>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={item.grossWeightGrams}
                        onChange={(e) =>
                          handleItemChange(
                            idx,
                            "grossWeightGrams",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        placeholder="0.00"
                        className="input-field font-mono text-xs py-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="input-label">Net & Fine Weight</label>
                      <div className="p-2 rounded-lg bg-(--bg-secondary) border border-(--border-primary) text-[11px] font-mono text-(--text-secondary) flex items-center justify-between h-[38px]">
                        <span>
                          Net: <b className="text-(--text-primary)">{netWeight.toFixed(2)}g</b>
                        </span>
                        <span>
                          Fine: <b className="text-(--accent)">{fineWeight.toFixed(2)}g</b>
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="input-label">Stone/Wax Weight (g)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.stoneWeightGrams}
                        onChange={(e) =>
                          handleItemChange(
                            idx,
                            "stoneWeightGrams",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        placeholder="0.00"
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
                          handleItemChange(
                            idx,
                            "valuationRatePerGram",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        placeholder="e.g. 7850"
                        className="input-field font-mono text-xs py-2"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="input-label">Packet No. (Secure Tag) *</label>
                      <input
                        type="text"
                        value={item.packetNumber}
                        onChange={(e) => handleItemChange(idx, "packetNumber", e.target.value)}
                        placeholder="e.g. PKT-001"
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
                        placeholder="e.g. Vault A / Rack 1 / Shelf 2"
                        className="input-field text-xs py-2"
                        required
                      />
                    </div>

                    {/* Section 3: ITEM PHOTOS - Camera & Gallery, multiple files, no bucket details */}
                    <div className="sm:col-span-4 pt-3 border-t border-(--border-primary)">
                      <ItemPhotosUploader
                        photos={item.photoUrls}
                        onChange={(newUrls) => handleItemChange(idx, "photoUrls", newUrls)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ==================== STEP 3: LOAN TERMS & VALUATION ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Loan Terms */}
          <div className="lg:col-span-2 glass-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-(--border-primary)">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-(--accent)" />
                <h2 className="text-base font-semibold text-(--text-primary)">
                  Step 3: Loan Terms & Disbursal
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClearStep3}
                className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 text-(--text-muted) hover:text-red-400 hover:border-red-500/30 transition-colors"
                title="Clear Step 3"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Principal Amount */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="input-label mb-0" htmlFor="principalAmount">
                    Principal Disbursal Amount (₹) *
                  </label>
                  {eligibleAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPrincipalAmount(eligibleAmount)}
                      className="text-xs font-semibold text-(--accent) hover:underline cursor-pointer"
                    >
                      Set Max Eligible ({formatINR(eligibleAmount)})
                    </button>
                  )}
                </div>
                <input
                  id="principalAmount"
                  type="number"
                  step="any"
                  min="1"
                  max={eligibleAmount > 0 ? eligibleAmount : undefined}
                  value={principalAmount}
                  onChange={(e) =>
                    setPrincipalAmount(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="Enter disbursal amount..."
                  className="input-field font-mono text-lg font-bold text-(--accent) py-3"
                  required
                />
                {eligibleAmount > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setPrincipalAmount(Math.round(eligibleAmount * pct))}
                        className="text-[10px] px-2 py-0.5 rounded bg-(--bg-tertiary) border border-(--border-primary) text-(--text-secondary) hover:text-(--accent) hover:border-(--accent-border) transition-all cursor-pointer font-mono"
                      >
                        {pct * 100}% ({formatINR(eligibleAmount * pct)})
                      </button>
                    ))}
                  </div>
                )}
                <span className="text-[11px] text-(--text-muted) mt-1 block">
                  Cannot exceed eligible amount based on {ltvPercent}% LTV slab.
                </span>
              </div>

              {/* Loan Interest Model Selection */}
              <div className="sm:col-span-2 p-4 rounded-xl bg-(--bg-secondary) border border-(--border-primary) space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-(--text-primary) flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-(--accent)" />
                    Interest Model & Structure
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInterestType("STANDARD")}
                      className={`text-xs px-3 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                        interestType === "STANDARD"
                          ? "bg-(--accent-bg) text-(--accent) border-(--accent-border) font-bold"
                          : "text-(--text-secondary) border-(--border-primary) hover:bg-(--bg-tertiary)"
                      }`}
                    >
                      Standard (Simple)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInterestType("CUMULATIVE")}
                      className={`text-xs px-3 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                        interestType === "CUMULATIVE"
                          ? "bg-(--accent-bg) text-(--accent) border-(--accent-border) font-bold"
                          : "text-(--text-secondary) border-(--border-primary) hover:bg-(--bg-tertiary)"
                      }`}
                    >
                      Cumulative
                    </button>
                  </div>
                </div>

                {/* Cumulative Options if Selected */}
                {interestType === "CUMULATIVE" && (
                  <div className="pt-3 border-t border-(--border-primary) grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                    <div>
                      <label className="input-label">Cumulative Period (Months) *</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={cumulativePeriodMonths}
                        onChange={(e) =>
                          setCumulativePeriodMonths(
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        placeholder="e.g. 12"
                        className="input-field font-mono text-xs py-2"
                        required
                      />
                      <span className="text-[10px] text-(--text-muted) mt-0.5 block">
                        Capitalization / settlement cycle interval
                      </span>
                    </div>

                    <div>
                      <label className="input-label">Interest Treatment *</label>
                      <select
                        value={interestTreatment}
                        onChange={(e) =>
                          setInterestTreatment(
                            e.target.value as "KEEP_SEPARATE" | "ADD_TO_CAPITAL"
                          )
                        }
                        className="input-field text-xs py-2"
                      >
                        <option value="KEEP_SEPARATE">Keep Interest Separate (No Auto-Capitalization)</option>
                        <option value="ADD_TO_CAPITAL">Add Interest to Capital (At Period End)</option>
                      </select>
                      <span className="text-[10px] text-(--text-muted) mt-0.5 block">
                        Controls whether accrued interest increases loan principal
                      </span>
                    </div>
                  </div>
                )}

                {/* Frequency & Rate Representation */}
                <div className="pt-3 border-t border-(--border-primary) grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Interest Frequency</label>
                    <select
                      value={interestFrequency}
                      onChange={(e) =>
                        setInterestFrequency(
                          e.target.value as
                            | "DAILY"
                            | "MONTHLY"
                            | "QUARTERLY"
                            | "HALF_YEARLY"
                            | "YEARLY"
                            | "CUSTOM"
                        )
                      }
                      className="input-field text-xs py-2"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="DAILY">Daily</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="HALF_YEARLY">Half-yearly</option>
                      <option value="YEARLY">Yearly</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="input-label mb-0">Rate Representation</label>
                      <div className="flex items-center gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setRateFormat("PERCENT")}
                          className={`px-1.5 py-0.5 rounded cursor-pointer ${
                            rateFormat === "PERCENT"
                              ? "bg-(--accent-bg) text-(--accent) font-bold"
                              : "text-(--text-muted)"
                          }`}
                        >
                          %
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => setRateFormat("PER_100")}
                          className={`px-1.5 py-0.5 rounded cursor-pointer ${
                            rateFormat === "PER_100"
                              ? "bg-(--accent-bg) text-(--accent) font-bold"
                              : "text-(--text-muted)"
                          }`}
                        >
                          ₹/₹100
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        max="10"
                        value={interestInputRate}
                        onChange={(e) =>
                          setInterestInputRate(
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        placeholder={rateFormat === "PERCENT" ? "e.g. 1.50" : "e.g. 1.50 per ₹100"}
                        className="input-field font-mono text-xs py-2 pr-16"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-(--text-muted) font-mono pointer-events-none">
                        {rateFormat === "PERCENT" ? "% pm" : "₹/₹100"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {[1.0, 1.25, 1.5, 2.0, 2.5].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setInterestInputRate(r)}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-(--bg-tertiary) border border-(--border-primary) text-(--text-secondary) hover:text-(--accent) cursor-pointer font-mono"
                        >
                          {rateFormat === "PERCENT" ? `${r}%` : `₹${r}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tenure Months */}
              <div>
                <label className="input-label flex items-center gap-1" htmlFor="tenureMonths">
                  <Calendar className="w-3.5 h-3.5 text-(--text-secondary)" />
                  Tenure (Months) *
                </label>
                <select
                  id="tenureMonths"
                  value={tenureMonths}
                  onChange={(e) =>
                    setTenureMonths(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="input-field text-sm py-2.5"
                  required
                >
                  <option value="">Select tenure...</option>
                  <option value={1}>1 Month</option>
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={9}>9 Months</option>
                  <option value={12}>12 Months (Max RBI Cap)</option>
                </select>
              </div>

              {/* Processing Fee */}
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
                  onChange={(e) =>
                    setProcessingFee(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="0.00"
                  className="input-field font-mono text-sm py-2.5"
                />
              </div>

              {/* Grace Period */}
              <div>
                <label className="input-label" htmlFor="grace">
                  Grace Period (Days)
                </label>
                <input
                  id="grace"
                  type="number"
                  step="any"
                  min="0"
                  max="90"
                  value={gracePeriodDays}
                  onChange={(e) =>
                    setGracePeriodDays(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="7 days (default)"
                  className="input-field font-mono text-sm py-2.5"
                />
              </div>
            </div>
          </div>

          {/* Right 1 Col: Valuation Card (Section 4 & 5 Cleaned Up) */}
          <div className="space-y-6">
            <div className="kpi-card border-(--accent-border) shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-(--border-primary)">
                {/* Section 5: Renamed to "Valuation" */}
                <span className="text-xs font-bold uppercase tracking-wider text-(--accent) flex items-center gap-1.5">
                  <Calculator className="w-4 h-4" />
                  Valuation
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
                    {principalAmount !== "" ? formatINR(Number(principalAmount)) : "₹0"}
                  </span>
                </div>
              </div>

              {/* Note: Section 5 explicitly removed "Tiered LTV Rules Applied (§6.2)" box */}
              {/* Note: Section 4 explicitly removed "Upload Collateral Photos & Signed Pawn Agreement" */}
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !selectedCustomer ||
                principalAmount === "" ||
                Number(principalAmount) > eligibleAmount ||
                Number(principalAmount) <= 0
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

      {/* ==================== ADD NEW METAL MODAL ==================== */}
      <Dialog open={newMetalModalOpen} onOpenChange={setNewMetalModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Metal Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="input-label">Metal Display Name *</label>
              <input
                type="text"
                value={newMetalName}
                onChange={(e) => setNewMetalName(e.target.value)}
                placeholder="e.g. Platinum, Rose Gold, Bronze"
                className="input-field text-sm py-2"
                autoFocus
              />
              <span className="text-[11px] text-(--text-muted) mt-1 block">
                This metal will be saved in master data and will appear in future loan forms.
              </span>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setNewMetalModalOpen(false)}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={addingMetal || !newMetalName.trim()}
              onClick={handleCreateMetal}
              className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
            >
              {addingMetal && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Metal
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== ADD NEW PURITY MODAL ==================== */}
      <Dialog open={newPurityModalOpen} onOpenChange={setNewPurityModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Purity Standard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="input-label">Purity Label *</label>
              <input
                type="text"
                value={newPurityLabel}
                onChange={(e) => setNewPurityLabel(e.target.value)}
                placeholder="e.g. 20K or 800 Silver"
                className="input-field text-sm py-2"
                autoFocus
              />
            </div>

            <div>
              <label className="input-label">Fineness Percentage (%) *</label>
              <input
                type="number"
                step="0.001"
                min="0.01"
                max="100"
                value={newPurityPercent}
                onChange={(e) =>
                  setNewPurityPercent(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="e.g. 83.33 for 20K"
                className="input-field font-mono text-sm py-2"
              />
              <span className="text-[11px] text-(--text-muted) mt-1 block">
                Actual pure metal fraction (0.01% – 100.0%). Used for fine weight calculations.
              </span>
            </div>

            <div>
              <label className="input-label">Fineness Code (Optional)</label>
              <input
                type="text"
                value={newPurityFineness}
                onChange={(e) => setNewPurityFineness(e.target.value)}
                placeholder="e.g. 833"
                className="input-field font-mono text-sm py-2"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setNewPurityModalOpen(false)}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={addingPurity || !newPurityLabel.trim() || newPurityPercent === ""}
              onClick={handleCreatePurity}
              className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
            >
              {addingPurity && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Purity
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
