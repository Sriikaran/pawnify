"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DocumentUploader } from "@/components/document-uploader";
import { useCreateCustomerMutation } from "@/lib/redux/api/customersApi";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

export default function NewCustomerPage() {
  const router = useRouter();
  const [createCustomer, { isLoading: loading }] = useCreateCustomerMutation();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    dob: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "Tamil Nadu",
    pincode: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^[6-9]\d{9}$/.test(formData.phone)) {
      setError("Please enter a valid 10-digit Indian mobile number starting with 6-9");
      return;
    }

    const res = await createCustomer(formData);

    if ("error" in res) {
      setError((res.error as { message?: string })?.message || "Failed to create customer");
    } else {
      router.push(`/customers/${res.data.customerId}`);
    }
  };

  const indianStates = [
    "Andhra Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Delhi",
    "Gujarat",
    "Haryana",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Tamil Nadu",
    "Telangana",
    "Uttar Pradesh",
    "West Bengal",
  ];

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-4">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-(--text-secondary) hover:text-(--accent) transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Customers List
        </Link>
      </div>

      <PageHeader
        title="Register New Customer"
        description="Enter verified KYC and contact information to create a customer profile for loan disbursal."
      />

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Details Card */}
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-(--border-primary)">
            <User className="w-5 h-5 text-(--accent)" />
            <h2 className="text-base font-semibold text-(--text-primary)">Personal Information</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="input-label flex items-center gap-1.5" htmlFor="fullName">
                Full Name (as per KYC document) *
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="e.g. Lakshmi Devi"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="input-label flex items-center gap-1.5" htmlFor="phone">
                <Phone className="w-3.5 h-3.5 text-(--text-secondary)" />
                Mobile Number (10 digits) *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                maxLength={10}
                value={formData.phone}
                onChange={handleChange}
                placeholder="9845012345"
                className="input-field font-mono"
                required
              />
              <span className="text-[11px] text-(--text-muted) mt-1 block">
                Must start with 6, 7, 8, or 9
              </span>
            </div>

            <div>
              <label className="input-label flex items-center gap-1.5" htmlFor="email">
                <Mail className="w-3.5 h-3.5 text-(--text-secondary)" />
                Email Address (Optional)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="lakshmi@example.com"
                className="input-field"
              />
            </div>

            <div>
              <label className="input-label flex items-center gap-1.5" htmlFor="dob">
                <Calendar className="w-3.5 h-3.5 text-(--text-secondary)" />
                Date of Birth (Optional)
              </label>
              <input
                id="dob"
                name="dob"
                type="date"
                value={formData.dob}
                onChange={handleChange}
                className="input-field text-(--text-secondary)"
              />
            </div>
          </div>
        </div>

        {/* Address Card */}
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-(--border-primary)">
            <MapPin className="w-5 h-5 text-(--accent)" />
            <h2 className="text-base font-semibold text-(--text-primary)">Residential Address</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="input-label" htmlFor="addressLine1">
                Address Line 1 (House/Flat No., Street/Area) *
              </label>
              <input
                id="addressLine1"
                name="addressLine1"
                type="text"
                value={formData.addressLine1}
                onChange={handleChange}
                placeholder="e.g. No. 12, Gandhi Nagar, 2nd Main Road"
                className="input-field"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="input-label" htmlFor="addressLine2">
                Address Line 2 (Landmark / Locality - Optional)
              </label>
              <input
                id="addressLine2"
                name="addressLine2"
                type="text"
                value={formData.addressLine2}
                onChange={handleChange}
                placeholder="Near Shiva Temple"
                className="input-field"
              />
            </div>

            <div>
              <label className="input-label" htmlFor="city">
                City / Town *
              </label>
              <input
                id="city"
                name="city"
                type="text"
                value={formData.city}
                onChange={handleChange}
                placeholder="Chennai"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="input-label" htmlFor="state">
                State *
              </label>
              <select
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="input-field"
                required
              >
                {indianStates.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="pincode">
                Pincode (6 digits) *
              </label>
              <input
                id="pincode"
                name="pincode"
                type="text"
                maxLength={6}
                value={formData.pincode}
                onChange={handleChange}
                placeholder="600001"
                className="input-field font-mono"
                required
              />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 sm:p-8 space-y-4">
          <DocumentUploader
            label="Upload Customer KYC Documents (Aadhaar / PAN / Photo ID)"
          />
        </div>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Link href="/customers" className="btn-secondary px-6 py-2.5">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-8 py-2.5 shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registering Customer...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Create Customer Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
